import Stripe from "stripe";
import mongoose from "mongoose";
import membershipPlanModel from "../models/membershipPlanModel.js";
import subscriptionModel from "../models/subscriptionModel.js";
import userModel from "../models/userModel.js";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

const RECOVERY_WINDOW_MS = 20 * 60 * 60 * 1000;

const getStripe = () => {
    if(!process.env.STRIPE_SECRET_KEY){
        throw new Error("Stripe secret key is not configured.");
    }

    return new Stripe(process.env.STRIPE_SECRET_KEY);
};

// Validate the Stripe monthly recurring price
const verifyRecurringPrice = async (stripe, plan) => {
    if(!plan.stripePriceId?.startsWith("price_")){
        throw new Error("Stripe Price ID is not configured.");
    }

    const price = await stripe.prices.retrieve(plan.stripePriceId);
    const expectedAmount = Math.round(Number(plan.price) * 100);

    if(!price.active || price.type !== "recurring" || price.recurring?.interval !== "month" || price.recurring?.interval_count !== 1 || price.currency !== "usd" || price.unit_amount !== expectedAmount || !Number.isSafeInteger(expectedAmount) || expectedAmount <= 0 || plan.currency !== "USD" || plan.billingInterval !== "month"){
        throw new Error("Stripe membership price configuration mismatch.");
    }

    return expectedAmount;
};

// Create identical Checkout parameters for safe Stripe retries
const buildCheckoutParams = (membership, plan, user) => {
    const membershipId = membership._id.toString();
    const userId = membership.userId.toString();
    const planId = membership.planId.toString();

    const metadata = {
        paymentType: "membership",
        membershipId,
        userId,
        planId
    };

    return {
        mode: "subscription",

        customer_email: user.email,

        line_items: [
            {
                price: plan.stripePriceId,
                quantity: 1
            }
        ],

        client_reference_id: membershipId,

        metadata,

        subscription_data: {
            metadata
        },

        success_url: `${FRONTEND_URL}/profile?membership_payment=success&session_id={CHECKOUT_SESSION_ID}`,

        cancel_url: `${FRONTEND_URL}/subscription?membership_payment=cancelled`
    };
};

// Create or recover a Checkout with the same idempotency key
const createOrRecoverSession = async (stripe, membership, plan, user) => {
    const membershipId = membership._id.toString();

    if(membership.stripeCheckoutSessionId){
        return stripe.checkout.sessions.retrieve(membership.stripeCheckoutSessionId);
    }

    // Stripe may have created the session before the server failed to save its ID. Retry only within a safe window.
    const age = Date.now() - new Date(membership.createdAt).getTime();

    if(age > RECOVERY_WINDOW_MS){
        throw new Error("UNRESOLVED_CHECKOUT");
    }

    const params = buildCheckoutParams(membership, plan, user);

    const session = await stripe.checkout.sessions.create(
        params,
        {
            idempotencyKey: `recurring-membership-checkout-${membershipId}`
        }
    );

    // Persist the session ID without replacing another ID
    const saved = await subscriptionModel.findOneAndUpdate(
        {
            _id: membership._id,
            status: "pending",
            paymentStatus: "Pending",
            stripeCheckoutSessionId: ""
        },
        {
            $set: {
                stripeCheckoutSessionId: session.id
            }
        },
        {
            new: true
        }
    );

    if(!saved){
        const latest = await subscriptionModel.findById(membership._id);

        if(!latest || latest.stripeCheckoutSessionId !== session.id){
            throw new Error("UNRESOLVED_CHECKOUT");
        }
    }

    return session;
};

// Check the actual Stripe Checkout status
const inspectCheckout = async (stripe, membership, session) => {
    if(session.mode !== "subscription" || session.client_reference_id !== membership._id.toString() || session.metadata?.paymentType !== "membership" || session.metadata?.membershipId !== membership._id.toString() || session.metadata?.userId !== membership.userId.toString() || session.metadata?.planId !== membership.planId.toString()){
        throw new Error("CHECKOUT_REFERENCE_MISMATCH");
    }

    if(session.status === "open"){
        const latestMembership = await subscriptionModel.findById(membership._id);

        if(!latestMembership || latestMembership.status !== "pending" || latestMembership.paymentStatus !== "Pending" || latestMembership.stripeCheckoutSessionId !== session.id || latestMembership.stripeSubscriptionId){
            throw new Error("UNRESOLVED_CHECKOUT");
        }

        if(!session.url){
            throw new Error("UNRESOLVED_CHECKOUT");
        }

        return {
            status: "open",
            checkoutUrl: session.url
        };

    }

    if(session.status === "complete"){
        // Do not create another subscription while Stripe payment or webhook processing may still be underway.
        return {
            status: "complete"
        };
    }

    if(session.status === "expired"){
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

        // Do not close a record linked to a Stripe subscription.
        if(subscriptionId){
            throw new Error("UNRESOLVED_CHECKOUT");
        }

        // Close an expired Checkout only if it is still pending
        const result = await subscriptionModel.updateOne(
            {
                _id: membership._id,
                status: "pending",
                paymentStatus: "Pending",
                stripeCheckoutSessionId: session.id,
                stripeSubscriptionId: ""
            },
            {
                $set: {
                    status: "cancelled",
                    paymentStatus: "Failed",
                    cancelledAt: new Date()
                }
            }
        );

        // Do not allow a new purchase unless the old pending record was successfully closed.
        if(result.modifiedCount !== 1){
            throw new Error("UNRESOLVED_CHECKOUT");
        }
        
        return {
            status: "expired"
        };
    }
    
    throw new Error("UNRESOLVED_CHECKOUT");
};

// Recover any existing pending purchase
const recoverPendingCheckout = async (stripe, userId, user) => {
    const pending = await subscriptionModel.findOne({ userId, status: "pending", paymentStatus: "Pending" }).sort({ createdAt: -1 });
    if(!pending){
        return {
            status: "clear"
        };
    }

    const plan = await membershipPlanModel.findById(pending.planId);

    if(!plan){
        throw new Error("UNRESOLVED_CHECKOUT");
    }

    // A saved session can be inspected even if its original plan price is no longer offered.
    if(!pending.stripeCheckoutSessionId){
        const currentAmount = Math.round(Number(plan.price) * 100);

        if(currentAmount !== Math.round(Number(pending.checkoutAmount) * 100)){
            throw new Error("UNRESOLVED_CHECKOUT");
        }

        await verifyRecurringPrice(stripe, plan);
    }

    const session = await createOrRecoverSession(stripe, pending, plan, user);

    return inspectCheckout(stripe, pending, session);
};

// Customer: Start recurring membership Checkout
export const createRecurringMembershipCheckout = async (req, res) => {
    try {
        const userId = req.userId;
        const { planId } = req.body || {};

        if(!userId){
            return res.status(401).json({
                success: false,
                message: "Please log in first."
            });
        }

        if(!mongoose.isValidObjectId(planId)){
            return res.status(400).json({
                success: false,
                message: "Invalid membership plan."
            });
        }

        const user = await userModel.findById(userId);

        if(!user || !user.email){
            return res.status(404).json({
                success: false,
                message: "Customer account not found."
            });
        }

        const stripe = getStripe();

        // An existing active or overdue subscription blocks a second subscription purchase.
        const existingSubscription = await subscriptionModel.findOne({
            userId,
            status: {
                $in: ["active", "past_due"]
            }
        });

        if(existingSubscription){
            return res.status(409).json({
                success: false,
                message: "You already have a membership. Please manage your existing subscription."
            });
        }

        // Recover the customer's previous checkout first.
        const recovery = await recoverPendingCheckout(stripe, userId, user);

        if(recovery.status === "open"){
            return res.status(200).json({
                success: true,
                resumed: true,
                checkoutUrl: recovery.checkoutUrl
            });
        }

        if(recovery.status === "complete"){
            return res.status(409).json({
                success: false,
                message: "Your previous checkout was completed. Please check your membership status."
            });
        }

        // The previous checkout was expired or nonexistent.
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

        const amountInCents = await verifyRecurringPrice(stripe, plan);

        // Recheck before creating the new purchase.
        const latestExisting = await subscriptionModel.findOne({
            userId,
            status: {
                $in: ["active", "past_due", "pending"]
            }
        });

        if(latestExisting){
            return res.status(409).json({
                success: false,
                message: "A membership or checkout already exists. Please refresh and try again."
            });
        }

        // Unique pending index provides an additional database-level concurrency safeguard.
        const membership = await subscriptionModel.create({
            userId,
            planId: plan._id,
            status: "pending",
            paymentStatus: "Pending",
            checkoutAmount: amountInCents / 100,
            checkoutCurrency: "USD",
            paidAmount: 0,
            paidCurrency: "USD"
        });

        const session = await createOrRecoverSession(stripe, membership, plan, user);

        return res.status(200).json({
            success: true,
            resumed: false,
            checkoutUrl: session.url,
            membershipId: membership._id,
            plan: {
                name: plan.name,
                price: plan.price,
                currency: plan.currency,
                billingInterval: "month"
            }
        });
        
    } catch (error) {
        console.error("Recurring Checkout Error:", error.message);

        if(error.code === 11000){
            return res.status(409).json({
                success: false,
                message: "Another membership checkout is being created. Please try again."
            });
        }

        if(error.message === "UNRESOLVED_CHECKOUT" || error.message === "CHECKOUT_REFERENCE_MISMATCH"){
            return res.status(409).json({
                success: false,
                message: "Your previous Stripe checkout needs verification. Please contact support before trying another purchase."
            });
        }

        return res.status(500).json({
            success: false,
            message: "Unable to start recurring membership checkout."
        });
    }
};