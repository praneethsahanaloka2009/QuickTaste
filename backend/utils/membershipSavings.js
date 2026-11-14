import mongoose from "mongoose";
import orderModel from "../models/orderModel.js";
import subscriptionModel from "../models/subscriptionModel.js";

// Track membership savings only once per eligible order
export const recordMembershipSavings = async (orderId) => {
    if(!mongoose.isValidObjectId(orderId)){
        throw new Error("Invalid order ID.");
    }

    const session = await mongoose.startSession();

    try {
        let result = {
            counted: false,
            savings: 0
        };

        await session.withTransaction(async () => {
            const order = await orderModel.findById(orderId).session(session);

            if(!order){
                throw new Error("Order not found.");
            }

            const savings = Number(order.membershipSavings || 0);

            // No membership benefit was applied
            if(!order.membershipId || !Number.isFinite(savings) || savings <= 0){
                return;
            }

            // Membership savings already recorded
            if(order.membershipSavingsCountedAt || order.membershipSavingsReversedAt){
                return;
            }

            // Do not count cancelled or refunded orders
            if(order.orderStatus === "Cancelled" || order.paymentStatus === "Refunded" || order.refundStatus === "Refunded"){
                return;
            }

            // Stripe: count after verified payment
            const stripeEligible = order.paymentMethod === "Stripe" && order.paymentStatus === "Paid";

            // COD: count after successful delivery and cash collection
            const codEligible = order.paymentMethod === "Cash on Delivery" && order.orderStatus === "Delivered" && order.riderCashCollected === true && order.riderDeliveryConfirmedAt != null;

            if(!stripeEligible && !codEligible){
                return;
            }

            // Atomic claim prevents duplicate counting
            const updatedOrder = await orderModel.findOneAndUpdate(
                {
                    _id: order._id,
                    membershipId: order.membershipId,
                    membershipSavingsCountedAt: null,
                    membershipSavingsReversedAt: null
                },
                {
                    $set: {
                        membershipSavingsCountedAt: new Date()
                    }
                },
                {
                    session,
                    returnDocument: "after"
                }
            );

            if(!updatedOrder){
                return;
            }

            // Update savings for the membership used by this order
            const updatedMembership = await subscriptionModel.findOneAndUpdate(
                {
                    _id: order.membershipId,
                    userId: order.userId
                },
                {
                    $inc: {
                        totalSavings: savings
                    }
                },
                {
                    session,
                    returnDocument: "after"
                }
            );

            if(!updatedMembership){
                // Roll back the order claim as well
                throw new Error("Membership not found for savings tracking.");
            }

            result = {
                counted: true,
                savings
            };
        });

        return result;
    } finally {
        await session.endSession();
    }
};

// Reverse membership savings after a confirmed full refund
export const reverseMembershipSavings = async (orderId) => {
    if(!mongoose.isValidObjectId(orderId)){
        throw new Error("Invalid order ID.");
    }

    const session = await mongoose.startSession();

    try {
        let result = {
            reversed: false,
            savings: 0
        };

        await session.withTransaction(async () => {
            const order = await orderModel.findById(orderId).session(session);

            if(!order){
                throw new Error("Order not found.");
            }

            const savings = Number(order.membershipSavings || 0);

            // Only reverse savings that were previously counted
            if(!order.membershipId || !order.membershipSavingsCountedAt || order.membershipSavingsReversedAt || !Number.isFinite(savings) || savings <= 0){
                return;
            }

            // Only process confirmed full Stripe refunds
            if(order.paymentMethod !== "Stripe" || order.paymentStatus !== "Refunded" || order.refundStatus !== "Refunded"){
                return;
            }

            // Require the full order payment to be refunded
            const orderTotal = Number((Number(order.amount) + Number(order.deliveryFee)).toFixed(2));

            const refundedAmount = Number(order.refundAmount || 0);

            if(!Number.isFinite(orderTotal) || !Number.isFinite(refundedAmount) || Math.round(refundedAmount * 100) < Math.round(orderTotal * 100)){
                return;
            }

            // Atomically claim the reversal
            const updatedOrder = await orderModel.findOneAndUpdate(
                {
                    _id: order._id,
                    membershipId: order.membershipId,
                    membershipSavingsCountedAt: { $ne: null },
                    membershipSavingsReversedAt: null,
                    paymentStatus: "Refunded",
                    refundStatus: "Refunded"
                },
                {
                    $set: {
                        membershipSavingsReversedAt: new Date()
                    }
                },
                {
                    session,
                    returnDocument: "after"
                }
            );

            if(!updatedOrder){
                return;
            }

            // Remove the savings from the original membership
            const updatedMembership = await subscriptionModel.findOneAndUpdate(
                {
                    _id: order.membershipId,
                    userId: order.userId
                },
                {
                    $inc: {
                        totalSavings: -savings
                    }
                },
                {
                    session,
                    returnDocument: "after"
                }
            );

            if(!updatedMembership){
                throw new Error("Membership not found for savings reversal.");
            }

            result = {
                reversed: true,
                savings
            };
        });

        return result;
    } finally {
        await session.endSession();
    }
};