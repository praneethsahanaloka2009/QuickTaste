import "dotenv/config";
import mongoose from "mongoose";
import orderModel from "../models/orderModel.js";
import subscriptionModel from "../models/subscriptionModel.js";

const membershipId = "6ae583b15a21741be35d469a";

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        console.log("MongoDB Connected");

        const membership = await subscriptionModel.findById(membershipId).lean();

        if(!membership){
            throw new Error("Membership not found.");
        }

        const orders = await orderModel.find({
            membershipId: new mongoose.Types.ObjectId(membershipId)
        }).lean();

        let expectedSavings = 0;

        console.log("Membership Orders:", orders.length);

        for(const order of orders){
            const counted = Boolean(
                order.membershipSavingsCountedAt
            );

            const reversed = Boolean(
                order.membershipSavingsReversedAt
            );

            const savings = Number(order.membershipSavings || 0);

            console.log({
                orderId: order._id.toString(),
                savings,
                counted,
                reversed,
                orderStatus: order.orderStatus,
                paymentStatus: order.paymentStatus
            });

            if(counted && !reversed){
                expectedSavings += savings;
            }
        }

        expectedSavings = Number(expectedSavings.toFixed(2));

        const storedSavings = Number(membership.totalSavings || 0);

        console.log("\n--- MEMBERSHIP SAVINGS REPORT ---");
        console.log("Stored Savings:", storedSavings);
        console.log("Expected Savings:", expectedSavings);

        console.log("Difference:", Number((storedSavings - expectedSavings).toFixed(2)));

        console.log("\nRead-only check completed.");
    } catch (error) {
        console.error("Check Error:", error.message);
    } finally {
        await mongoose.disconnect();
    }
};

run();