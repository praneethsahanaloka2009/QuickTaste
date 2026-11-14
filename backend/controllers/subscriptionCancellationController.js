import Stripe from "stripe";
import subscriptionModel from "../models/subscriptionModel.js";

const getStripe = () => {
    if(!process.env.STRIPE_SECRET_KEY){
        throw new Error("Stripe secret key is not configured.");
    }

    return new Stripe(process.env.STRIPE_SECRET_KEY);
};

// Customer: Cancel membership renewal at billing period end
export const cancelMembershipSubscription = async (req, res) => {
    try {
        const userId = req.userId;

        if(!userId){
            return res.status(401).json({
                success: false,
                message: "Please log in to manage your membership."
            });
        }

        // Find customer's existing subscription
        const membership = await subscriptionModel.findOne({
            userId,
            status: {
                $in: ["active", "past_due"]
            },
            stripeSubscriptionId: {
                $type: "string",
                $gt: ""
            }
        }).sort({ createdAt: -1 });

        if(!membership){
            return res.status(404).json({
                success: false,
                message: "No recurring membership found."
            });
        }

        const stripe = getStripe();

        // Retrieve the actual Stripe subscription
        const stripeSubscription = await stripe.subscriptions.retrieve(membership.stripeSubscriptionId);

        // Verify Stripe subscription ownership
        const metadata = stripeSubscription.metadata || {};

        if(metadata.paymentType !== "membership" || metadata.membershipId !== membership._id.toString() || metadata.userId !== membership.userId.toString() || metadata.planId !== membership.planId.toString()){
            return res.status(403).json({
                success: false,
                message: "Stripe membership ownership verification failed."
            });
        }

        // Prevent a mismatch between stored and Stripe customer
        const stripeCustomerId = typeof stripeSubscription.customer === "string" ? stripeSubscription.customer : stripeSubscription.customer?.id;

        if(membership.stripeCustomerId && membership.stripeCustomerId !== stripeCustomerId){
            return res.status(403).json({
                success: false,
                message: "Stripe customer mismatch."
            });
        }

        // Cancellation was previously requested
        if(stripeSubscription.cancel_at_period_end){
            await subscriptionModel.updateOne(
                {
                    _id: membership._id
                },
                {
                    $set: {
                        cancelAtPeriodEnd: true
                    }
                }
            );

            return res.status(200).json({
                success: true,
                message: "Automatic renewal is already cancelled.",
                cancelAtPeriodEnd: true,
                currentPeriodEnd: membership.currentPeriodEnd
            });
        }

        // Only running subscriptions can be scheduled for period-end cancellation.
        if(!["active", "past_due"].includes(stripeSubscription.status)){
            return res.status(409).json({
                success: false,
                message: "This subscription cannot be scheduled for cancellation."
            });
        }

        // Request cancellation at the end of the billing period
        const updatedSubscription = await stripe.subscriptions.update(
            membership.stripeSubscriptionId,
            {
                cancel_at_period_end: true
            }
        );

        // Synchronize membership cancellation setting
        await subscriptionModel.updateOne(
            {
                _id: membership._id,
                stripeSubscriptionId: updatedSubscription.id
            },
            {
                $set: {
                    cancelAtPeriodEnd:
                        updatedSubscription.cancel_at_period_end,
                    cancelledAt: new Date()
                }
            }
        );

        // Keep membership active until the paid period ends.
        // Actual termination is handled by Stripe webhooks.
        return res.status(200).json({
            success: true,
            message: "Automatic renewal cancelled successfully. Your membership remains available until the end of your paid billing period.",
            cancelAtPeriodEnd: updatedSubscription.cancel_at_period_end,
            currentPeriodEnd: membership.currentPeriodEnd
        });

    } catch (error) {
        console.error("Cancel Membership Subscription Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to cancel membership renewal."
        });
    }
}