import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import mongoose from "mongoose";
import subscriptionModel from "../models/subscriptionModel.js";
import subscriptionPaymentModel from "../models/subscriptionPaymentModel.js";

const TEST_INVOICE_ID = "in_1UW6oKEDK5n2q2r7K5cwNgmu";

const TEST_EVENT_ID = "evt_1UW6r5EDK5n2q2r74k0wKU4d";

const WEBHOOK_URL = "http://localhost:4911/api/subscription/stripe/webhook";

const fail = (message) => {
    throw new Error(message);
};

const main = async () => {
    const mongoUri = process.env.MONGODB_URI;
    const webhookSecret = process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET;

    if(!mongoUri || !webhookSecret){
        fail("Missing MongoDB URI or subscription webhook secret.");
    }

    if(!webhookSecret.startsWith("whsec_")){
        fail("Invalid webhook secret configuration.");
    }

    const eventPath = path.resolve(
        process.cwd(),
        "../renewal-event.json"
    );

    const rawEvent = await fs.readFile(eventPath, "utf8");
    const event = JSON.parse(rawEvent);

    if(event.id !== TEST_EVENT_ID || event.type !== "invoice.paid" || event.data?.object?.id !== TEST_INVOICE_ID || event.data?.object?.status !== "paid" || event.data?.object?.billing_reason !== "subscription_cycle" || event.data?.object?.amount_paid !== 299 || event.livemode !== false){
        fail("Renewal event verification failed.");
    }

    await mongoose.connect(mongoUri);

    const originalPayment = await subscriptionPaymentModel.findOne({
        stripeInvoiceId: TEST_INVOICE_ID
    });

    if(!originalPayment || originalPayment.paymentStatus !== "Paid"){
        fail("Verified paid renewal record not found.");
    }

    const membershipId = originalPayment.subscriptionId;

    const membershipBefore = await subscriptionModel.findById(
        membershipId
    );

    if(!membershipBefore){
        fail("Test membership not found.");
    }

    const paymentsBefore = await subscriptionPaymentModel.find({
        subscriptionId: membershipId,
        paymentStatus: "Paid"
    }).lean();

    if(paymentsBefore.length !== 2 || paymentsBefore.reduce((sum, payment) => sum + Number(payment.amount || 0), 0).toFixed(2) !== "5.98"){
        fail("Unexpected initial payment history. Test cancelled.");
    }

    const periodEndBefore = membershipBefore.currentPeriodEnd?.getTime();

    if(!periodEndBefore){
        fail("Membership period is missing.");
    }

    console.log("REPLAY PRECHECK PASSED");
    console.log("Paid payment count:", paymentsBefore.length);
    console.log("Total paid: $5.98");

    // Sign the exact JSON body using Stripe's signature format.
    const timestamp = Math.floor(Date.now() / 1000);

    const signature = crypto.createHmac("sha256", webhookSecret).update(`${timestamp}.${rawEvent}`).digest("hex");

    const stripeSignature = `t=${timestamp},v1=${signature}`;

    const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Stripe-Signature": stripeSignature
        },
        body: rawEvent
    });

    const responseText = await response.text();

    if(!response.ok){
        fail(`Webhook replay failed (${response.status}): ${responseText}`);
    }

    const paymentsAfter = await subscriptionPaymentModel.find({
        subscriptionId: membershipId,
        paymentStatus: "Paid"
    }).lean();

    const membershipAfter = await subscriptionModel.findById(membershipId);

    const totalAfter = paymentsAfter.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

    const periodEndAfter = membershipAfter?.currentPeriodEnd?.getTime();

    if(paymentsAfter.length !== 2 || totalAfter.toFixed(2) !== "5.98" || periodEndAfter !== periodEndBefore){
        fail("Webhook replay changed expected membership/payment state.");
    }

    console.log("SIGNED WEBHOOK REPLAY PASSED");
    console.log("HTTP Status:", response.status);
    console.log("Paid payment count:", paymentsAfter.length);
    console.log("Total paid:", `$${totalAfter.toFixed(2)}`);
    console.log("Membership expiry:", membershipAfter.currentPeriodEnd.toISOString());
};

main().catch((error) => {
    console.error("SIGNED WEBHOOK REPLAY TEST FAILED:", error.message);
    process.exitCode = 1;
}).finally(async () => {
    await mongoose.disconnect();
});