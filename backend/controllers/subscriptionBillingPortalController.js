import Stripe from "stripe";
import subscriptionModel from "../models/subscriptionModel.js";

const createMembershipBillingPortal = async (req, res) => {
    try {
        const userId = req.userId;

        if(!userId){
            return res.status(401).json({
                success: false,
                message: "Authentication required."
            });
        }

        const stripeKey = process.env.STRIPE_SECRET_KEY;
        const frontendUrl = process.env.FRONTEND_URL;

        if(!stripeKey || !frontendUrl){
            return res.status(503).json({
                success: false,
                message: "Billing portal is not configured."
            });
        }

        // Find only a membership owned by the authenticated user.
        const membership = await subscriptionModel.findOne({ userId, status: { $in: ["active", "past_due"] }, stripeCustomerId: { $type: "string", $gt: "" }, stripeSubscriptionId: { $type: "string", $gt: "" } }).sort({ createdAt: -1 });

        if(!membership){
            return res.status(404).json({
                success: false,
                message: "No eligible membership found."
            });
        }

        const stripe = new Stripe(stripeKey);

        // Verify the Stripe subscription belongs to this customer.
        const stripeSubscription = await stripe.subscriptions.retrieve(membership.stripeSubscriptionId);

        if(stripeSubscription.customer !== membership.stripeCustomerId || stripeSubscription.metadata?.userId !== String(userId) || stripeSubscription.metadata?.membershipId !== String(membership._id) || stripeSubscription.metadata?.paymentType !== "membership"){
            return res.status(403).json({
                success: false,
                message: "Membership billing verification failed."
            });
        }

        const returnUrl = new URL("/profile", frontendUrl.endsWith("/") ? frontendUrl : `${frontendUrl}/`).toString();

        const session = await stripe.billingPortal.sessions.create({
            customer: membership.stripeCustomerId,
            return_url: returnUrl
        });

        return res.status(200).json({
            success: true,
            url: session.url
        });

    } catch (error) {
        console.error("Create membership billing portal error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to open membership billing portal."
        });
    }
};

export { createMembershipBillingPortal };