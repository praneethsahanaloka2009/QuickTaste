import Stripe from "stripe";
import mongoose from "mongoose";
import membershipPlanModel from "../models/membershipPlanModel.js";
import subscriptionModel from "../models/subscriptionModel.js";
import userModel from "../models/userModel.js";
import { expireMemberships } from "./subscriptionController.js";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// Stripe initialization
const getStripe = () => {
    if(!process.env.STRIPE_SECRET_KEY){
        throw new Error("Stripe secret key is not configured.");
    }

    return new Stripe(process.env.STRIPE_SECRET_KEY);
}

 // Activate a membership only after verified Stripe payment
export const completeMembershipPayment = async (session) => {
    const membershipId = session.metadata?.membershipId;
    const userId = session.metadata?.userId;
    const planId = session.metadata?.planId;

    // Validate Stripe membership metadata
    if(session.metadata?.paymentType !== "membership" || !mongoose.isValidObjectId(membershipId) || !mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(planId)){
        throw new Error("Invalid membership payment metadata.");
    }

    const membership = await subscriptionModel.findById(membershipId);

    if(!membership){
        throw new Error("Membership purchase record not found.");
    }

    // Validate membership ownership and Checkout Session
    if(membership.userId.toString() !== userId || membership.planId.toString() !== planId || membership.stripeCheckoutSessionId !== session.id || session.client_reference_id !== membershipId){
        throw new Error("Membership payment reference mismatch.");
    }

    // Verify original checkout price snapshot
    const expectedAmount = Math.round(
        Number(membership.checkoutAmount) * 100
    );

    if(!Number.isSafeInteger(expectedAmount) || expectedAmount <= 0 || membership.checkoutCurrency !== "USD"){
        throw new Error("Invalid membership checkout price snapshot.");
    }

    // Verify Stripe payment
    if(session.mode !== "payment" || session.payment_status !== "paid" || session.currency !== "usd" || session.amount_total !== expectedAmount){
        throw new Error("Membership payment verification failed.");
    }

    // Return if this payment was already processed
    if(membership.paymentStatus === "Paid" && ["active", "expired"].includes(membership.status)){
        return membership;
    }

    // Expire previous memberships
    await expireMemberships(userId);

    // Prevent multiple active memberships
    const existingActive = await subscriptionModel.findOne({
        userId: membership.userId,
        status: "active",
        currentPeriodEnd: { $gt: new Date() },
        _id: { $ne: membership._id }
    });

    if(existingActive){
        throw new Error("Customer already has another active membership.");
    }

    const startDate = new Date();

    const endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || "";

    // Atomic activation: only one webhook can update Pending -> Paid
    const activatedMembership = await subscriptionModel.findOneAndUpdate(
        {
            _id: membership._id,
            userId: membership.userId,
            planId: membership.planId,
            stripeCheckoutSessionId: session.id,
            paymentStatus: "Pending",
            status: "pending"
        },
        {
            $set: {
                paymentStatus: "Paid",
                status: "active",
                startDate,
                currentPeriodStart: startDate,
                currentPeriodEnd: endDate,
                paidAmount: session.amount_total / 100,
                paidCurrency: "USD",
                stripePaymentIntentId: paymentIntentId
            }
        },
        {
            new: true,
            runValidators: true
        }
    );

    if(activatedMembership){
        console.log(`Membership activated successfully: ${activatedMembership._id}`);

        return activatedMembership;
    }

    // Handle webhook retry after successful activation
    const latestMembership = await subscriptionModel.findById(membershipId);

    if(latestMembership && latestMembership.paymentStatus === "Paid" && ["active", "expired"].includes(latestMembership.status)){
        return latestMembership;
    }

    throw new Error("Membership activation could not be completed.");
};

// Find a Stripe Checkout Session using the membership reference
const findMembershipCheckoutSession = async (stripe, membership) => {
    const membershipId = membership._id.toString();

    // Search recent Stripe Checkout Sessions
    // Do not create a new session during recovery
    let startingAfter;

    for(let page = 0; page < 5; page++){
        const result = await stripe.checkout.sessions.list({
            limit: 100,
            ...(startingAfter ? { starting_after: startingAfter } : {})
        });

        const matchingSession = result.data.find((session) => session.mode === "payment" && session.client_reference_id === membershipId && session.metadata?.paymentType === "membership" && session.metadata?.membershipId === membershipId && session.metadata?.userId === membership.userId.toString() && session.metadata?.planId === membership.planId.toString());

        if(matchingSession){
            return matchingSession;
        }

        if(!result.has_more || result.data.length === 0){
            break;
        }

        startingAfter = result.data[result.data.length - 1].id;
    }

    return null;
};

// Recover previous pending membership checkouts
const recoverPendingMembershipCheckout = async (userId, stripe) => {
    const pendingMemberships = await subscriptionModel.find({
        userId,
        status: "pending",
        paymentStatus: "Pending"
    });

    for(const membership of pendingMemberships){
        // A checkout is still being created.
        if(!membership.stripeCheckoutSessionId){
            // Check whether Stripe created a Checkout Session
            // but MongoDB failed to save its ID
            const recoveredSession = await findMembershipCheckoutSession(stripe, membership);

            if(!recoveredSession){
                // The Stripe request may still be running.
                // Do not delete the pending membership or create another checkout.
                throw new Error("Your previous membership checkout could not be confirmed. Please contact support if this continues.");
            }

            // Save the recovered Stripe Checkout Session ID
            const recoverySaveResult = await subscriptionModel.updateOne(
                {
                    _id: membership._id,
                    userId: membership.userId,
                    status: "pending",
                    paymentStatus: "Pending",
                    stripeCheckoutSessionId: ""
                },
                {
                    $set: {
                        stripeCheckoutSessionId: recoveredSession.id
                    }
                }
            );

            if(recoverySaveResult.matchedCount !== 1){
                throw new Error("Membership checkout recovery could not be saved.");
            }

            membership.stripeCheckoutSessionId = recoveredSession.id;
        }

        // Retrieve actual Stripe Checkout status
        const session = await stripe.checkout.sessions.retrieve(membership.stripeCheckoutSessionId);

        // Payment was successful: activate the existing purchase
        if(session.status === "complete" && session.payment_status === "paid"){
            await completeMembershipPayment(session);

            return { 
                status: "paid"
            };
        }

        // Checkout is still open: reuse the existing checkout
        if(session.status === "open"){
            return {
                status: "open",
                checkoutUrl: session.url
            };
        }

        // Checkout expired without payment
        if(session.status === "expired"){
            await subscriptionModel.updateOne(
                {
                    _id: membership._id,
                    status: "pending",
                    paymentStatus: "Pending"
                },
                {
                    $set: {
                        status: "cancelled",
                        paymentStatus: "Failed",
                        cancelledAt: new Date()
                    }
                }
            );
        }
    }

    return {
        status: "clear"
    };
};

// Create a one-time membership checkout
export const createMembershipCheckout = async (req, res) => {
    let membership = null;
    let stripeSessionCreated = false;
    let stripeRequestStarted = false;

    try {
        const userId = req.userId;
        const { planId } = req.body;

        // Authentication
        if(!userId){
            return res.status(401).json({
                success: false,
                message: "Please log in to purchase a membership."
            });
        }

        // Validate plan ID
        if(!mongoose.isValidObjectId(planId)){
            return res.status(400).json({
                success: false,
                message: "Invalid membership plan."
            });
        }

        // Check customer
        const user = await userModel.findById(userId);

        if(!user){
            return res.status(404).json({
                success: false,
                message: "Customer not found."
            });
        }

        // Load trusted plan details from MongoDB
        const plan = await membershipPlanModel.findOne({
            _id: planId,
            isActive: true
        });

        if(!plan){
            return res.status(404).json({
                success: false,
                message: "Membership plan is unavailable."
            });
        }

        // Expire any previous completed membership
        await expireMemberships(userId);

        // Prevent purchasing while a membership is active
        const activeMembership = await subscriptionModel.findOne({
            userId,
            status: "active",
            currentPeriodEnd: {
                $gt: new Date()
            }
        });

        if(activeMembership){
            return res.status(409).json({
                success: false,
                message: "You already have an active membership. You can purchase another plan after it expires."
            });
        }

        // Recover existing pending Stripe Checkout Sessions
        const stripe = getStripe();

        const recovery = await recoverPendingMembershipCheckout(userId, stripe);

        if(recovery.status === "paid"){
            return res.status(409).json({
                success: false,
                message: "Your previous membership payment was successful. Please refresh your profile."
            });
        }

        if (recovery.status === "open"){
            return res.status(200).json({
                success: true,
                checkoutUrl: recovery.checkoutUrl,
                resumed: true
            });
        }

        // Validate USD price
        const amountInCents = Math.round(Number(plan.price) * 100);

        if(!Number.isSafeInteger(amountInCents) || amountInCents < 50 || plan.currency?.toUpperCase() !== "USD"){
            return res.status(400).json({
                success: false,
                message: "Invalid membership price or currency."
            });
        }

        // Save a pending purchase record
        membership = await subscriptionModel.create({
            userId,
            planId: plan._id,
            status: "pending",
            paymentStatus: "Pending",
            checkoutAmount: amountInCents / 100,
            checkoutCurrency: "USD",
            paidAmount: 0,
            paidCurrency: "USD"
        });

        const membershipId = membership._id.toString();

        // Stripe may create a session even if the API response is lost
        stripeRequestStarted = true;

        // Stripe one-time payment
        const session = await stripe.checkout.sessions.create(
            {
                mode: "payment",
                customer_email: user.email,
                line_items: [
                    {
                        price_data: {
                            currency: "usd",
                            product_data: {
                                name: `QuickTaste ${plan.name} Membership`,
                                description: "30-day membership. No automatic renewal."
                            },
                            unit_amount: amountInCents
                        },
                        quantity: 1
                    }
                ],

                client_reference_id: membershipId,

                metadata: {
                    paymentType: "membership",
                    membershipId,
                    userId: userId.toString(),
                    planId: plan._id.toString()
                },

                success_url: `${FRONTEND_URL}/profile?membership_payment=success&session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${FRONTEND_URL}/subscription?membership_payment=cancelled`,
                expires_at: Math.floor(Date.now() / 1000) + 30 * 60
            },
            {
                idempotencyKey: `membership-checkout-${membershipId}`
            }
        );

        // Stripe confirmed that a Checkout Session was created
        stripeSessionCreated = true;

        // Persist the Checkout Session ID before returning the URL
        const sessionSaveResult = await subscriptionModel.updateOne(
            {
                _id: membership._id,
                status: "pending",
                paymentStatus: "Pending"
            },
            {
                $set: {
                    stripeCheckoutSessionId: session.id
                }
            }
        );

        if(sessionSaveResult.matchedCount !== 1){
            throw new Error("Unable to link Stripe Checkout Session to membership.");
        }

        membership.stripeCheckoutSessionId = session.id;

        return res.status(200).json({
            success: true,
            checkoutUrl: session.url,
            membershipId,
            plan: {
                name: plan.name,
                price: plan.price,
                currency: plan.currency,
                durationDays: 30
            }
        });

    } catch (error) {
        console.error("Membership Checkout Error:", error.message);

        // Handle simultaneous checkout requests safely
        if(error.code === 11000){
            try {
                // The first request may have created a pending membership
                const existingPending = await subscriptionModel.findOne({
                    userId: req.userId,
                    status: "pending",
                    paymentStatus: "Pending"
                });

                if(existingPending){
                    // Stripe Checkout is still being created
                    if(!existingPending.stripeCheckoutSessionId){
                        return res.status(409).json({
                            success: false,
                            message: "Your membership checkout is being prepared. Please try again shortly."
                        });
                    }

                    // Check the existing Stripe Checkout
                    const stripe = getStripe();

                    const session = await stripe.checkout.sessions.retrieve(existingPending.stripeCheckoutSessionId);

                    // Reuse an existing open Checkout Session
                    if(session.status === "open" && session.url){
                        return res.status(200).json({
                            success: true,
                            checkoutUrl: session.url,
                            resumed: true
                        });
                    }

                    // Previous payment already succeeded
                    if(session.status === "complete" && session.payment_status === "paid"){
                        await completeMembershipPayment(session);

                        return res.status(409).json({
                            success: false,
                            message: "Your membership payment was successful. Please refresh your profile."
                        });
                    }

                    return res.status(409).json({
                        success: false,
                        message: "Your previous checkout is being updated. Please try again shortly."
                    });
                }

                return res.status(409).json({
                    success: false,
                    message: "A membership checkout already exists. Please try again."
                });

            } catch (recoveryError) {
                console.error("Duplicate Checkout Recovery Error:", recoveryError.message);

                return res.status(500).json({
                    success: false,
                    message: "Unable to recover your existing membership checkout."
                });
            }
        }

        // Clean up only records without a Stripe session.
        // Do not remove a paid membership.
        if(membership?._id && !stripeRequestStarted && !stripeSessionCreated && !membership.stripeCheckoutSessionId){
            try {
                await subscriptionModel.deleteOne({
                    _id: membership._id,
                    status: "pending",
                    paymentStatus: "Pending",
                    stripeCheckoutSessionId: ""
                });
            } catch (cleanupError) {
                console.error("Membership cleanup error:", cleanupError.message);
            }
        }

        return res.status(500).json({
            success: false,
            message: "Unable to start membership checkout."
        });
    }
};