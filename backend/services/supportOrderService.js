import mongoose from "mongoose";
import orderModel from "../models/orderModel.js";

// Recognize questions asking for the customer's actual order.
const isLiveOrderQuestion = (message) => {
    const text = message.toLowerCase().trim();

    // General instructions should still be answered by Gemini.
    if(/how (do|can|should) i (track|place|make|cancel)/i.test(text) || /how to (track|place|make|cancel)/i.test(text)){
        return false;
    }

    return [
        /\b(latest|last|recent|current)\s+order\b/,
        /\b(my|our)\s+orders?\b/,
        /\b(where\s+is|where's)\s+my\s+(order|food|delivery)\b/,
        /\b(track|tracking|status|update|progress)\b.*\border\b/,
        /\border\b.*\b(track|tracking|status|update|progress)\b/,
        /\b(payment\s+status|has\s+my\s+payment|did\s+my\s+payment)\b/,
        /\b(where\s+is|where's)\s+my\s+rider\b/
    ].some((pattern) => pattern.test(text));
};

const formatOrderFallback = (order) => {
    const trackingUrl = `/track-order/${order.orderId}`;

    return [
        `Here are the verified details of your QuickTaste order.`,
        ``,
        `**Order ID:** ${order.orderId}`,
        `**Order Status:** ${order.orderStatus}`,
        `**Payment Status:** ${order.paymentStatus}`,
        `**Payment Method:** ${order.paymentMethod}`,
        `**Rider Assigned:** ${order.riderAssigned ? "Yes" : "Not yet"}`,
        ``,
        `**Track your order:** [View Order](${trackingUrl})`,
        ``,
        `These details are from your QuickTaste order record.`
    ].join("\n");
};

// Read-only lookup, restricted to the authenticated customer.
export const getSupportOrderContext = async (customerId, message) => {
    if(!mongoose.isValidObjectId(customerId)){
        throw new Error("Invalid authenticated customer.");
    }

    if(typeof message !== "string" || !isLiveOrderQuestion(message)){
        return null;
    }

    // If a valid MongoDB-style Order ID is mentioned, look for that exact order, owned by this customer.
    const requestedOrderId = message.match(/\b[a-f0-9]{24}\b/i)?.[0];

    let order;

    if(requestedOrderId){
        order = await orderModel.findOne({ _id: requestedOrderId, userId: customerId }).select("_id orderStatus paymentStatus paymentMethod assignedRider createdAt").lean();
    } else {
        // Latest order belonging to the logged-in customer.
        order = await orderModel.findOne({ userId: customerId }).select("_id orderStatus paymentStatus paymentMethod assignedRider createdAt").sort({ createdAt: -1, _id: -1 }).lean();
    }

    if(!order){
        return {
            directReply: requestedOrderId ? "I couldn't find that order in your QuickTaste account. Please check the Order ID in My Orders." : "I couldn't find any orders in your QuickTaste account yet. You can check My Orders or contact Human Support.",
            verifiedOrder: null,
            fallbackReply: null
        };
    }

    // Only allowlisted, verified fields are passed to Gemini.
    // Never send address, phone, OTP, payment secrets, etc.
    const verifiedOrder = {
        orderId: String(order._id),
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        riderAssigned: Boolean(order.assignedRider),
        createdAt: order.createdAt ? new Date(order.createdAt).toISOString() : null,
        trackingPath: `/track-order/${order._id}`
    };

    return {
        directReply: null,
        verifiedOrder,
        fallbackReply: formatOrderFallback(verifiedOrder)
    };
}