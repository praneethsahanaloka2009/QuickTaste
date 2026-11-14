import "dotenv/config";
import mongoose from "mongoose";
import Stripe from "stripe";
import subscriptionPaymentModel from "../models/subscriptionPaymentModel.js";
import { handleInvoicePaid } from "../controllers/subscriptionWebhookController.js";

const INVOICE_ID = "in_1UVxoEEDK5n2q2r72wi5GclB";

const main = async () => {
    if(!process.env.STRIPE_SECRET_KEY || !process.env.MONGODB_URI){
        throw new Error("Missing Stripe or MongoDB configuration.");
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    await mongoose.connect(process.env.MONGODB_URI);

    const invoice = await stripe.invoices.retrieve(INVOICE_ID);

    if(invoice.id !== INVOICE_ID || invoice.status !== "paid" || invoice.currency !== "usd" || invoice.amount_paid !== 299 || invoice.amount_remaining !== 0){
        throw new Error("Paid invoice verification failed.");
    }

    const beforeCount = await subscriptionPaymentModel.countDocuments({
        stripeInvoiceId: INVOICE_ID
    });

    console.log("Payment records before:", beforeCount);

    await handleInvoicePaid(stripe, invoice);

    const afterCount = await subscriptionPaymentModel.countDocuments({
        stripeInvoiceId: INVOICE_ID
    });

    console.log("Payment records after:", afterCount);

    if(beforeCount !== 1 || afterCount !== 1){
        throw new Error("Duplicate payment history detected.");
    }

    console.log("INVOICE IDEMPOTENCY TEST PASSED");
};

try {
    await main();
} catch (error) {
    console.error("INVOICE IDEMPOTENCY TEST FAILED:", error.message);
    process.exitCode = 1;
} finally {
    await mongoose.disconnect();
}