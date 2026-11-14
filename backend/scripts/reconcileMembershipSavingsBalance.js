import "dotenv/config";
import mongoose from "mongoose";
import orderModel from "../models/orderModel.js";
import subscriptionModel from "../models/subscriptionModel.js";


// QuickTaste Premium membership being investigated
const MEMBERSHIP_ID = "6ae583b15a21741be35d469a";

// Default: READ ONLY
const APPLY = process.argv.includes("--apply");

const EXPECTED_STORED = "2.90";
const EXPECTED_COMPUTED = "0.00";

// Convert USD values to integer cents
const toCents = (value) => {
    const number = Number(value);

    if(!Number.isFinite(number) || number < 0){
        throw new Error("Invalid membership savings amount.");
    }

    return Math.round(number * 100);
};

const formatUSD = (cents) => {
    return `$${(cents / 100).toFixed(2)}`;
};

// Calculate outstanding savings from saved order records
const calculateBalance = (orders) => {
    let totalCents = 0;
    let countedOrders = 0;
    let reversedOrders = 0;
    let outstandingOrders = 0;

    for(const order of orders){
        const counted = Boolean(
            order.membershipSavingsCountedAt
        );

        const reversed = Boolean(
            order.membershipSavingsReversedAt
        );

        const savingsCents = toCents(
            order.membershipSavings || 0
        );

        if(counted){
            countedOrders++;
        }

        if(reversed){
            reversedOrders++;
        }

        if(counted && !reversed){
            totalCents += savingsCents;
            outstandingOrders++;
        }

        console.log({
            orderId: order._id.toString(),
            savings: formatUSD(savingsCents),
            counted,
            reversed,
            orderStatus: order.orderStatus,
            paymentStatus: order.paymentStatus,
            refundStatus: order.refundStatus
        });
    }

    return {totalCents, countedOrders, reversedOrders, outstandingOrders};
};

const main = async () => {
    if(!process.env.MONGODB_URI){
        throw new Error("MONGODB_URI is not configured.");
    }

    await mongoose.connect(process.env.MONGODB_URI);

    console.log("MongoDB Connected");

    const membershipObjectId = new mongoose.Types.ObjectId(MEMBERSHIP_ID);

    // Read-only inspection mode
    if(!APPLY){
        const membership = await subscriptionModel.findById(membershipObjectId).lean();

        if(!membership){
            throw new Error("Membership not found.");
        }

        const orders = await orderModel.find({
            membershipId: membershipObjectId
        }).lean();

        console.log("\n--- MEMBERSHIP ORDERS ---");

        const calculated = calculateBalance(orders);

        const storedCents = toCents(membership.totalSavings || 0);

        console.log("\n--- RECONCILIATION REPORT ---");
        console.log("Mode: READ ONLY");
        console.log("Membership ID:", MEMBERSHIP_ID);
        console.log("Total Orders:", orders.length);
        console.log("Counted Orders:", calculated.countedOrders);
        console.log("Reversed Orders:", calculated.reversedOrders);
        console.log("Outstanding Orders:", calculated.outstandingOrders);
        console.log("Stored Savings:", formatUSD(storedCents));
        console.log("Expected Savings:", formatUSD(calculated.totalCents));
        console.log("Difference:", formatUSD(Math.abs(storedCents - calculated.totalCents)));
        console.log("\nNo database changes were made.");
        return;
    }

    // Explicit confirmation guards for correction
    if(!process.argv.includes(`--expect-stored=${EXPECTED_STORED}`) || !process.argv.includes(`--expect-computed=${EXPECTED_COMPUTED}`)){
        throw new Error("Correction requires explicit expected-balance arguments.");
    }

    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            const membership = await subscriptionModel.findById(membershipObjectId).session(session);

            if(!membership){
                throw new Error("Membership not found.");
            }

            const orders = await orderModel.find({
                membershipId: membershipObjectId
            }).session(session).lean();

            console.log("\n--- TRANSACTION VERIFICATION ---");

            const calculated = calculateBalance(orders);

            const storedCents = toCents(membership.totalSavings || 0);

            // Apply only to the exact investigated state
            if(storedCents !== toCents(EXPECTED_STORED) || calculated.totalCents !== toCents(EXPECTED_COMPUTED)){
                throw new Error("Balances changed. Correction cancelled.");
            }

            if(orders.length !== 1 || calculated.countedOrders !== 1 || calculated.reversedOrders !== 1 || calculated.outstandingOrders !== 0){
                throw new Error("Order records differ from the verified case.");
            }

            const order = orders[0];

            if(order.orderStatus !== "Cancelled" || order.paymentStatus !== "Refunded" || order.refundStatus !== "Refunded" || !order.membershipSavingsCountedAt || !order.membershipSavingsReversedAt){
                throw new Error("Refund or savings reversal is not confirmed.");
            }

            const oldSavingsValue = membership.totalSavings ?? 0;

            const updated = await subscriptionModel.findOneAndUpdate(
                {
                    _id: membershipObjectId,
                    totalSavings: oldSavingsValue
                },
                {
                    $set: {
                        totalSavings: calculated.totalCents / 100
                    }
                },
                {
                    session,
                    returnDocument: "after",
                    runValidators: true
                }
            );

            if(!updated){
                throw new Error("Membership changed during correction.");
            }

            console.log("Previous Savings:", formatUSD(storedCents));

            console.log("Corrected Savings:", formatUSD(calculated.totalCents));
        });

        console.log("\nMembership balance correction committed.");
    } finally {
        await session.endSession();
    }
};

try {
    await main();
} catch (error) {
    console.error("\nRECONCILIATION ERROR:", error.message);
    process.exitCode = 1;
} finally {
    await mongoose.disconnect();
}