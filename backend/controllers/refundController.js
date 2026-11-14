import mongoose from "mongoose";
import Stripe from "stripe";
import orderModel from "../models/orderModel.js";
import { reverseMembershipSavings } from "../utils/membershipSavings.js";

// Initialize Stripe safely
const getStripe = () => {
    if(!process.env.STRIPE_SECRET_KEY){
        throw new Error("Stripe secret key is not configured.");
    }

    return new Stripe(process.env.STRIPE_SECRET_KEY);
};

// Convert USD amount to cents
const toCents = (amount) => {
    return Math.round(Number(amount) * 100);
};

// Issue a full Stripe refund for a cancelled order
export const refundStripePayment = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { reason } = req.body || {};

        // Validate order ID
        if(!mongoose.isValidObjectId(orderId)){
            return res.status(400).json({
                success: false,
                message: "Invalid order ID."
            });
        }

        // Validate refund reason
        if(typeof reason !== "string" || !reason.trim() || reason.trim().length > 500){
            return res.status(400).json({
                success: false,
                message: "Please provide a valid refund reason."
            });
        }

        const order = await orderModel.findById(orderId);

        if(!order){
            return res.status(404).json({
                success: false,
                message: "Order not found."
            });
        }

        // Only cancelled orders can be refunded
        if(order.orderStatus !== "Cancelled"){
            return res.status(400).json({
                success: false,
                message: "Only cancelled orders can be refunded."
            });
        }

        // Only paid Stripe orders
        if(order.paymentMethod !== "Stripe" || order.paymentStatus !== "Paid"){
            return res.status(400).json({
                success: false,
                message: "Only paid Stripe orders can be refunded."
            });
        }

        // Prevent duplicate refunds
        if(order.refundStatus === "Refunded" || order.paymentStatus === "Refunded"){
            return res.status(409).json({
                success: false,
                message: "This order has already been refunded."
            });
        }

        if(order.refundStatus !== "Not Requested" || order.stripeRefundId){
            return res.status(409).json({
                success: false,
                message: "A refund has already been attempted. " + "Please verify its Stripe status before retrying."
            });
        }

        const refundAmount = toCents(Number(order.amount) + Number(order.deliveryFee));

        if(!Number.isSafeInteger(refundAmount) || refundAmount <= 0){
            return res.status(400).json({
                success: false,
                message: "Invalid refund amount."
            });
        }

        const stripe = getStripe();

        // Use the payment intent associated with this food order
        let paymentIntentId = order.stripePaymentIntentId;

        if(!paymentIntentId && order.stripeSessionId){
            const checkoutSession = await stripe.checkout.sessions.retrieve(order.stripeSessionId);

            if(checkoutSession.mode !== "payment" || checkoutSession.payment_status !== "paid" || checkoutSession.metadata?.orderId !== order._id.toString()){
                return res.status(400).json({
                    success: false,
                    message: "Stripe payment verification failed."
                });
            }

            paymentIntentId = typeof checkoutSession.payment_intent === "string" ? checkoutSession.payment_intent : checkoutSession.payment_intent?.id;
        }

        if(!paymentIntentId){
            return res.status(400).json({
                success: false,
                message: "Stripe Payment Intent ID not found."
            });
        }

        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if(paymentIntent.status !== "succeeded" || paymentIntent.currency !== "usd" || paymentIntent.amount_received !== refundAmount){
            return res.status(400).json({
                success: false,
                message: "Stripe payment amount verification failed."
            });
        }

        // Atomically reserve the refund operation
        const claimedOrder = await orderModel.findOneAndUpdate(
            {
                _id: order._id,
                orderStatus: "Cancelled",
                paymentMethod: "Stripe",
                paymentStatus: "Paid",
                refundStatus: "Not Requested",
                stripeRefundId: null
            },
            {
                $set: {
                    refundStatus: "Processing",
                    refundRequestedAt: new Date(),
                    refundReason: reason.trim(),
                    stripePaymentIntentId: paymentIntentId
                }
            },
            {
                returnDocument: "after",
                runValidators: true
            }
        );

        if(!claimedOrder){
            return res.status(409).json({
                success: false,
                message: "Refund already requested or order details changed."
            });
        }

        let refund;

        try {
            refund = await stripe.refunds.create(
                {
                    payment_intent: paymentIntentId,
                    amount: refundAmount,
                    reason: "requested_by_customer",
                    metadata: {
                        orderId: order._id.toString(),
                        refundReason: reason.trim()
                    }
                },
                {
                    idempotencyKey: `quicktaste-food-refund-${order._id}`
                }
            );
        } catch (stripeError) {
            console.error("Stripe Refund Request Error:", stripeError.message);

            // Keep Processing because the Stripe outcome may be unknown.
            // Reconciliation must check Stripe before any retry.
            return res.status(502).json({
                success: false,
                message: "Refund status could not be confirmed. Check Stripe before retrying."
            });
        }

        const refundSucceeded = refund.status === "succeeded";

        const updatedOrder = await orderModel.findOneAndUpdate(
            {
                _id: order._id,
                paymentMethod: "Stripe",
                orderStatus: "Cancelled",
                paymentStatus: "Paid",
                refundStatus: "Processing",
                $or: [
                    {
                        stripeRefundId: refund.id
                    },
                    {
                        stripeRefundId: null
                    }
                ]
            },
            {
                $set: {
                    stripeRefundId: refund.id,
                    refundAmount: refund.amount / 100,
                    refundStatus: refundSucceeded ? "Refunded" : refund.status === "failed" || refund.status === "canceled" ? "Failed" : "Processing",
                    ...(refundSucceeded ? {paymentStatus: "Refunded", refundedAt: new Date()} : {})
                }
            },
            {
                returnDocument: "after",
                runValidators: true
            }
        );

        // A webhook may have updated this order first
        if(!updatedOrder){
            const currentOrder = await orderModel.findById(order._id);

            if(currentOrder?.stripeRefundId === refund.id && currentOrder.refundStatus === "Refunded" && currentOrder.paymentStatus === "Refunded"){
                if(currentOrder.membershipId){
                    await reverseMembershipSavings(currentOrder._id);
                }

                return res.status(200).json({
                    success: true,
                    message: "Stripe refund already completed.",
                    refundId: refund.id,
                    refundStatus: "Refunded",
                    refundAmount: currentOrder.refundAmount,
                    orderId: currentOrder._id
                });
            }

            return res.status(409).json({
                success: false,
                message: "Refund state changed. Please check its current status."
            });
        }

        if(refundSucceeded && updatedOrder.membershipId){
            try {
                await reverseMembershipSavings(updatedOrder._id);
            } catch (savingsError) {
                console.error("Membership Savings Reversal Error:", savingsError.message);
            }
        }

        return res.status(200).json({
            success: true,
            message: refundSucceeded ? "Stripe refund completed successfully." : "Stripe refund request submitted. Awaiting final status.",
            refundId: refund.id,
            refundStatus: updatedOrder.refundStatus,
            refundAmount: updatedOrder.refundAmount,
            orderId: updatedOrder._id
        });
    } catch (error) {
        console.error("Refund Controller Error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to process refund. Please check its status."
        });
    }
};

// Verify the current refund status directly with Stripe
export const reconcileStripeRefund = async (refundId) => {
    if(typeof refundId !== "string" || !refundId.startsWith("re_")){
        throw new Error("Invalid Stripe refund ID.");
    }

    const stripe = getStripe();

    // Never trust the webhook payload status alone
    const refund = await stripe.refunds.retrieve(refundId);

    const orderId = refund.metadata?.orderId;

    if(!mongoose.isValidObjectId(orderId)){
        throw new Error("Refund does not contain a valid order ID.");
    }

    const order = await orderModel.findById(orderId);

    if(!order){
        throw new Error("Refund order not found.");
    }

    if(order.paymentMethod !== "Stripe" || order.orderStatus !== "Cancelled"){
        throw new Error("Order is not eligible for Stripe refund.");
    }

    // Never apply a different refund to the same order
    if(order.stripeRefundId && order.stripeRefundId !== refund.id){
        throw new Error("Refund ID does not match the order.");
    }

    let expectedPaymentIntentId = order.stripePaymentIntentId;

    if(!expectedPaymentIntentId && order.stripeSessionId){
        const checkoutSession = await stripe.checkout.sessions.retrieve(order.stripeSessionId);

        if(checkoutSession.mode !== "payment" || checkoutSession.payment_status !== "paid" || checkoutSession.metadata?.orderId !== orderId){
            throw new Error("Stripe Checkout Session mismatch.");
        }

        expectedPaymentIntentId = typeof checkoutSession.payment_intent === "string" ? checkoutSession.payment_intent : checkoutSession.payment_intent?.id;
    }

    const refundPaymentIntentId = typeof refund.payment_intent === "string" ? refund.payment_intent : refund.payment_intent?.id;

    if(!expectedPaymentIntentId || refundPaymentIntentId !== expectedPaymentIntentId){
        throw new Error("Refund Payment Intent mismatch.");
    }

    const expectedAmount = toCents(Number(order.amount) + Number(order.deliveryFee));

    if(!Number.isSafeInteger(expectedAmount) || expectedAmount <= 0 || refund.amount !== expectedAmount || refund.currency !== "usd"){
        throw new Error("Full refund amount or currency mismatch.");
    }

    // Do not overwrite a completed refund with an older status
    if(order.refundStatus === "Refunded" && order.paymentStatus === "Refunded"){

        // Confirm that Stripe also reports a successful refund
        if(refund.status !== "succeeded"){
            throw new Error("Stripe refund status conflicts with the completed order.");
        }

        // Reverse membership savings only once
        if(order.membershipId){
            await reverseMembershipSavings(order._id);
        }

        return {
            reconciled: true,
            refundStatus: "Refunded",
            orderId: order._id
        };
    }

    const refundSucceeded = refund.status === "succeeded";

    const refundFailed = refund.status === "failed" || refund.status === "canceled";

    // Update only the matching refund and eligible order
    const updatedOrder = await orderModel.findOneAndUpdate(
        {
            _id: order._id,
            paymentMethod: "Stripe",
            orderStatus: "Cancelled",
            paymentStatus: "Paid",
            refundStatus: {
                $in: [
                    "Processing", "Pending", "Failed"
                ]
            },
            $or: [
                {
                    stripeRefundId: refund.id
                },
                {
                    stripeRefundId: null
                }
            ]
        },
        {
            $set: {
                stripeRefundId: refund.id,
                stripePaymentIntentId: expectedPaymentIntentId,
                refundAmount: refund.amount / 100,
                refundStatus: refundSucceeded
                    ? "Refunded"
                    : refundFailed
                        ? "Failed"
                        : "Processing",
                ...(refundSucceeded
                    ? {
                        paymentStatus: "Refunded",
                        refundedAt: new Date()
                    }
                    : {})
            }
        },
        {
            returnDocument: "after",
            runValidators: true
        }
    );

    if(!updatedOrder){
        const currentOrder = await orderModel.findById(order._id);

        // Another request may already have completed the refund
        if(currentOrder?.stripeRefundId === refund.id && currentOrder.refundStatus === "Refunded" && currentOrder.paymentStatus === "Refunded" && refund.status === "succeeded"){
            if(currentOrder.membershipId){
                await reverseMembershipSavings(currentOrder._id);
            }

            return {
                reconciled: true,
                refundStatus: "Refunded",
                refundAmount: currentOrder.refundAmount,
                orderId: currentOrder._id
            };
        }

        throw new Error("Refund reconciliation conflict. Manual review may be required.");
    }

    // Reverse savings only after a confirmed full refund
    if(refundSucceeded && updatedOrder.membershipId){
        await reverseMembershipSavings(updatedOrder._id);
    }

    return {
        reconciled: true,
        refundStatus: updatedOrder.refundStatus,
        refundAmount: updatedOrder.refundAmount,
        orderId: updatedOrder._id
    };
};

// Recover an existing Stripe refund without creating a new refund
export const recoverStripeRefund = async (orderId) => {
    if(!mongoose.isValidObjectId(orderId)){
        throw new Error("Invalid order ID.");
    }

    const order = await orderModel.findById(orderId);

    if(!order){
        throw new Error("Order not found.");
    }

    if(order.paymentMethod !== "Stripe" || order.orderStatus !== "Cancelled"){
        throw new Error("Order is not eligible for refund recovery.");
    }

    if(order.refundStatus === "Not Requested"){
        return {
            recovered: false,
            message: "No refund has been requested."
        };
    }

    const stripe = getStripe();

    let paymentIntentId = order.stripePaymentIntentId;

    if(!paymentIntentId && order.stripeSessionId){
        const checkoutSession = await stripe.checkout.sessions.retrieve(order.stripeSessionId);

        if(checkoutSession.mode !== "payment" || checkoutSession.payment_status !== "paid" || checkoutSession.metadata?.orderId !== order._id.toString()){
            throw new Error("Stripe Checkout Session mismatch.");
        }

        paymentIntentId = typeof checkoutSession.payment_intent === "string" ? checkoutSession.payment_intent : checkoutSession.payment_intent?.id;
    }

    if(!paymentIntentId){
        throw new Error("Stripe Payment Intent ID not found.");
    }

    // If the refund ID is already stored, reconcile it directly
    if(order.stripeRefundId){
        const result = await reconcileStripeRefund(order.stripeRefundId);

        return {
            recovered: true,
            ...result
        };
    }

    // Search existing Stripe refunds for this payment intent
    // Never create another refund during recovery
    const matchingRefunds = [];

    for await (const refund of stripe.refunds.list({ payment_intent: paymentIntentId, limit: 100 })){
        if(refund.metadata?.orderId === order._id.toString()){
            matchingRefunds.push(refund);
        }
    }

    if(matchingRefunds.length === 0){
        return {
            recovered: false,
            message: "No matching Stripe refund was found. " + "Do not retry automatically."
        };
    }

    if(matchingRefunds.length > 1){
        throw new Error(
            "Multiple refunds found. Manual review is required."
        );
    }

    const result = await reconcileStripeRefund(matchingRefunds[0].id);

    return {
        recovered: true,
        ...result
    };
};

// Admin: Check and recover an existing Stripe refund
// This endpoint NEVER creates a new refund.
export const recoverStripeRefundAdmin = async (req, res) => {
    try {
        const { orderId } = req.params;

        if(!mongoose.isValidObjectId(orderId)){
            return res.status(400).json({
                success: false,
                message: "Invalid order ID."
            });
        }

        const order = await orderModel.findById(orderId);

        if(!order){
            return res.status(404).json({
                success: false,
                message: "Order not found."
            });
        }

        if(order.paymentMethod !== "Stripe" || order.orderStatus !== "Cancelled"){
            return res.status(400).json({
                success: false,
                message: "Only cancelled Stripe orders support refund recovery."
            });
        }

        if(order.refundStatus === "Not Requested"){
            return res.status(409).json({
                success: false,
                message: "No previous refund request exists."
            });
        }

        const result = await recoverStripeRefund(order._id);

        if(!result.recovered){
            return res.status(200).json({
                success: true,
                recovered: false,
                message: result.message || "No matching Stripe refund found. Manual review is required.",
                orderId: order._id
            });
        }

        return res.status(200).json({
            success: true,
            recovered: true,
            message: "Existing Stripe refund status checked.",
            refundStatus: result.refundStatus,
            refundAmount: result.refundAmount ?? null,
            orderId: result.orderId
        });
    } catch (error) {
        console.error("Admin Refund Recovery Error:", error.message);

        return res.status(409).json({
            success: false,
            message: "Refund recovery could not be completed. " + "Check Stripe Dashboard and backend logs before retrying."
        });
    }
};