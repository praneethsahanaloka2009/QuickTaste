import "dotenv/config";
import mongoose from "mongoose";
import Stripe from "stripe";
import subscriptionModel from "../models/subscriptionModel.js";
import subscriptionPaymentModel from "../models/subscriptionPaymentModel.js";
import { handleInvoicePaid } from "../controllers/subscriptionWebhookController.js";

const MEMBERSHIP_ID = "6ae418492c14c9904ac7732c";
const USER_ID = "6ae4164d4cfacfc53635196d";
const PLAN_ID = "6ae0c96b8da2eea9f81ecb48";

const CUSTOMER_ID = "cus_VXB12Eh4d9JVOM";
const SUBSCRIPTION_ID = "sub_1UW6mLEDK5n2q2r7BTUIwWNr";

const INVOICES = [
    "in_1UW6mLEDK5n2q2r7IMKbqMsr",
    "in_1UW6oKEDK5n2q2r7K5cwNgmu"
];

const getId = (value) => {
    return typeof value === "string" ? value : value?.id || "";
}

const main = async () => {
    if(!process.env.STRIPE_SECRET_KEY || !process.env.MONGODB_URI){
        throw new Error("Missing Stripe or MongoDB configuration.");
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    await mongoose.connect(process.env.MONGODB_URI);

    const membership = await subscriptionModel.findById(MEMBERSHIP_ID);

    if(!membership || membership.userId.toString() !== USER_ID || membership.planId.toString() !== PLAN_ID || membership.stripeCustomerId !== CUSTOMER_ID || membership.stripeSubscriptionId !== SUBSCRIPTION_ID || membership.checkoutAmount !== 2.99 || !["pending", "active"].includes(membership.status)){
        throw new Error("Test membership verification failed.");
    }

    const subscription = await stripe.subscriptions.retrieve(SUBSCRIPTION_ID);

    if(subscription.status !== "active" || subscription.livemode !== false || subscription.test_clock !== "clock_1UW6bwEDK5n2q2r7XCZqGhri" || getId(subscription.customer) !== CUSTOMER_ID || getId(subscription.items?.data?.[0]?.price) !== "price_1UVaIpEDK5n2q2r7FIZoiOzT" || subscription.metadata?.paymentType !== "membership" || subscription.metadata?.membershipId !== MEMBERSHIP_ID || subscription.metadata?.userId !== USER_ID || subscription.metadata?.planId !== PLAN_ID){
        throw new Error("Stripe subscription verification failed.");
    }

    console.log("TEST SUBSCRIPTION PRECHECK PASSED");

    for(const invoiceId of INVOICES){
        const invoice = await stripe.invoices.retrieve(invoiceId);

        const invoiceSubscriptionId = getId(
            invoice.parent?.subscription_details?.subscription || invoice.subscription
        );

        if(invoice.livemode !== false || invoice.status !== "paid" || invoice.currency !== "usd" || invoice.amount_paid !== 299 || invoice.amount_remaining !== 0 || getId(invoice.customer) !== CUSTOMER_ID || invoiceSubscriptionId !== SUBSCRIPTION_ID){
            throw new Error(`Invoice verification failed: ${invoiceId}`);
        }

        console.log(`Processing verified invoice: ${invoiceId}`);

        await handleInvoicePaid(stripe, invoice);

        const payment = await subscriptionPaymentModel.findOne({
            stripeInvoiceId: invoiceId
        });

        const updatedMembership = await subscriptionModel.findById(MEMBERSHIP_ID);

        if(!payment || payment.subscriptionId.toString() !== MEMBERSHIP_ID || payment.userId.toString() !== USER_ID || payment.planId.toString() !== PLAN_ID || payment.stripeSubscriptionId !== SUBSCRIPTION_ID || payment.paymentStatus !== "Paid" || payment.amount !== 2.99 || payment.currency !== "USD" || updatedMembership?.status !== "active" || updatedMembership?.paymentStatus !== "Paid"){
            throw new Error(`Reconciliation result failed: ${invoiceId}`);
        }

        console.log(`INVOICE RECONCILED: ${invoiceId}`);
        console.log({
            membershipStatus: updatedMembership.status,
            paymentStatus: updatedMembership.paymentStatus,
            currentPeriodStart: updatedMembership.currentPeriodStart,
            currentPeriodEnd: updatedMembership.currentPeriodEnd
        });
    }

    const paymentCount = await subscriptionPaymentModel.countDocuments({
        subscriptionId: MEMBERSHIP_ID,
        stripeInvoiceId: { $in: INVOICES }
    });

    if(paymentCount !== 2){
        throw new Error("Expected exactly two reconciled invoices.");
    }

    console.log("MONTHLY RENEWAL RECONCILIATION PASSED");
};

try {
    await main();
} catch (error) {
    console.error("RENEWAL TEST FAILED:", error.message);
    process.exitCode = 1;
} finally {
    await mongoose.disconnect();
}