import "dotenv/config";
import mongoose from "mongoose";
import Stripe from "stripe";
import subscriptionModel from "../models/subscriptionModel.js";
import { handleInvoicePaid } from "../controllers/subscriptionWebhookController.js";

const INVOICE_ID = "in_1UVxoEEDK5n2q2r72wi5GclB";
const MEMBERSHIP_ID = "6ae38c2a3860966e268a2066";
const SUBSCRIPTION_ID = "sub_1UVxoGEDK5n2q2r7g5IgfWk7";

const getId = (value) => {
    return typeof value === "string" ? value : value?.id || "";
}

const main = async () => {
    if(!process.env.STRIPE_SECRET_KEY || !process.env.MONGODB_URI){
        throw new Error("Stripe or MongoDB configuration missing.");
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    await mongoose.connect(process.env.MONGODB_URI);

    const invoice = await stripe.invoices.retrieve(INVOICE_ID);
    const subscription = await stripe.subscriptions.retrieve(SUBSCRIPTION_ID);
    const membership = await subscriptionModel.findById(MEMBERSHIP_ID).lean();

    if(!membership){
        throw new Error("Membership record not found.");
    }

    const invoiceSubscriptionId = getId(invoice.parent?.subscription_details?.subscription || invoice.subscription);

    if(invoice.id !== INVOICE_ID || invoice.status !== "paid" || invoice.currency !== "usd" || invoice.amount_paid !== 299 || invoice.amount_remaining !== 0 || invoiceSubscriptionId !== SUBSCRIPTION_ID || subscription.id !== SUBSCRIPTION_ID || subscription.status !== "active" || subscription.metadata?.paymentType !== "membership" || subscription.metadata?.membershipId !== MEMBERSHIP_ID || membership.stripeSubscriptionId !== SUBSCRIPTION_ID || membership.checkoutAmount !== 2.99){
        throw new Error("Membership reconciliation verification failed.");
    }

    console.log("RECONCILIATION PRECHECK PASSED");

    if(membership.status === "active" && membership.paymentStatus === "Paid"){
        console.log("Membership is already active. No changes needed.");
        return;
    }

    if(membership.status !== "pending" || membership.paymentStatus !== "Pending"){
        throw new Error("Unexpected membership state. Reconciliation stopped.");
    }

    // Reuse the existing verified invoice handler. This writes payment history and activates membership through the existing MongoDB transaction.
    await handleInvoicePaid(stripe, invoice);

    const updatedMembership = await subscriptionModel.findById(MEMBERSHIP_ID).lean();

    if(updatedMembership?.status !== "active" || updatedMembership?.paymentStatus !== "Paid" || !updatedMembership?.currentPeriodEnd){
        throw new Error("Invoice processing completed but membership activation is not confirmed.");
    }

    console.log("MEMBERSHIP RECONCILIATION SUCCESSFUL");
    console.log({
        status: updatedMembership.status,
        paymentStatus: updatedMembership.paymentStatus,
        paidAmount: updatedMembership.paidAmount,
        currentPeriodEnd: updatedMembership.currentPeriodEnd,
        cancelAtPeriodEnd: updatedMembership.cancelAtPeriodEnd
    });
};

try {
    await main();
} catch (error) {
    console.error("RECONCILIATION PRECHECK FAILED:", error.message);
    process.exitCode = 1;
} finally {
    await mongoose.disconnect();
}