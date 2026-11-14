import Stripe from "stripe";
import mongoose from "mongoose";
import subscriptionModel from "../models/subscriptionModel.js";
import membershipPlanModel from "../models/membershipPlanModel.js";
import subscriptionPaymentModel from "../models/subscriptionPaymentModel.js";

const getStripe = () => {
    if(!process.env.STRIPE_SECRET_KEY){
        throw new Error("Stripe secret key is not configured.");
    }

    return new Stripe(process.env.STRIPE_SECRET_KEY);
};

// Resolve Stripe IDs whether expanded or unexpanded
const getId = (value) => {
    if(typeof value === "string"){
        return value;
    }

    return value?.id || "";
}

// Support different Stripe Invoice API shapes
const getInvoiceSubscriptionId = (invoice) => {
    return getId(
        invoice.parent?.subscription_details?.subscription || invoice.subscription
    );
};

// Get an authenticated membership reference
const findMembership = async (stripeSubscription) => {
    const metadata = stripeSubscription.metadata || {};
    const membershipId = metadata.membershipId;

    if(metadata.paymentType !== "membership" || !mongoose.isValidObjectId(membershipId) || !mongoose.isValidObjectId(metadata.userId) || !mongoose.isValidObjectId(metadata.planId)){
        throw new Error("Invalid subscription metadata.");
    }

    const membership = await subscriptionModel.findById(membershipId);

    if(!membership || membership.userId.toString() !== metadata.userId || membership.planId.toString() !== metadata.planId){
        throw new Error("Membership reference mismatch.");
    }
    
    if(membership.stripeSubscriptionId && membership.stripeSubscriptionId !== stripeSubscription.id){
        throw new Error("Stripe subscription ID mismatch.");
    }
    
    if(membership.stripeCustomerId && membership.stripeCustomerId !== getId(stripeSubscription.customer)){
        throw new Error("Stripe customer ID mismatch.");
    }

    return membership;
};

// Read Stripe's actual billing period
const getBillingPeriod = (stripeSubscription) => {
    const item = stripeSubscription.items?.data?.[0];

    const start = item?.current_period_start ?? stripeSubscription.current_period_start;

    const end = item?.current_period_end ?? stripeSubscription.current_period_end;

    if(!Number.isInteger(start) || !Number.isInteger(end) || end <= start){
        throw new Error("Invalid Stripe billing period.");
    }

    return {
        start: new Date(start * 1000),
        end: new Date(end * 1000)
    };
};

// Verify membership plan and recurring Stripe Price
const verifyPlan = async (stripe, membership, stripeSubscription) => {
    const plan = await membershipPlanModel.findById(membership.planId);

    if(!plan){
        throw new Error("Membership plan not found.");
    }

    const subscriptionItem = stripeSubscription.items?.data?.[0];
    const priceId = getId(subscriptionItem?.price);


    if(stripeSubscription.items?.data?.length !== 1 || !priceId || priceId !== plan.stripePriceId){
        throw new Error("Membership Stripe Price mismatch.");
    }

    const price = await stripe.prices.retrieve(priceId);

    if(price.currency !== "usd" || price.recurring?.interval !== "month" || price.recurring?.interval_count !== 1 || price.unit_amount !== Math.round(Number(membership.checkoutAmount) * 100)){
        throw new Error("Membership billing price mismatch.");
    }

    return plan;
}

// Connect Stripe Checkout to membership
const handleCheckoutCompleted = async (stripe, session) => {
    if(session.mode !== "subscription" || session.metadata?.paymentType !== "membership"){
        return;
    }

    const subscriptionId = getId(session.subscription);

    if(!subscriptionId){
        throw new Error("Checkout subscription ID missing.");
    }

    const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);

    const membership = await findMembership(stripeSubscription);

    if(session.client_reference_id !== membership._id.toString() || session.metadata?.membershipId !== membership._id.toString() || session.metadata?.userId !== membership.userId.toString() || session.metadata?.planId !== membership.planId.toString()){
        throw new Error("Checkout ownership mismatch.");
    }

    if(membership.stripeCheckoutSessionId && membership.stripeCheckoutSessionId !== session.id){
        throw new Error("Checkout Session ID mismatch.");
    }

    await verifyPlan(stripe, membership, stripeSubscription);

    await subscriptionModel.updateOne(
        {
            _id: membership._id
        },
        {
            $set: {
                stripeCheckoutSessionId: session.id,
                stripeSubscriptionId: subscriptionId,
                stripeCustomerId: getId(session.customer),
                cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end
            }
        }
    );

    // Do not activate membership here.
    // Activation requires a verified paid invoice.
};

// Successful initial membership payment or monthly renewal
export const handleInvoicePaid = async (stripe, invoiceEvent) => {
    const subscriptionId = getInvoiceSubscriptionId(invoiceEvent);

    if(!subscriptionId){
        return;
    }

    // Retrieve the latest invoice directly from Stripe
    const invoice = await stripe.invoices.retrieve(invoiceEvent.id);

    // Diagnostic log
    console.log("QuickTaste Invoice Verification:", {
        status: invoice.status,
        paid: invoice.paid,
        currency: invoice.currency,
        amountPaid: invoice.amount_paid,
        amountRemaining: invoice.amount_remaining,
        billingReason: invoice.billing_reason
    });

    // Verify the paid Stripe invoice
    if(invoice.status !== "paid" || invoice.currency !== "usd" || !Number.isSafeInteger(invoice.amount_paid) || invoice.amount_paid <= 0 || invoice.amount_remaining !== 0 || !invoice.status_transitions?.paid_at){
        throw new Error("Invoice payment is not verified.");
    }

    const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);

    // Ignore invoices unrelated to QuickTaste memberships
    if(stripeSubscription.metadata?.paymentType !== "membership"){
        return;
    }

    const membership = await findMembership(stripeSubscription);

    await verifyPlan(stripe, membership, stripeSubscription);

    if(getId(invoice.customer) !== getId(stripeSubscription.customer)){
        throw new Error("Stripe invoice customer mismatch.");
    }

    if(stripeSubscription.status !== "active"){
        throw new Error("Subscription is not active.");
    }

    // Find the matching subscription invoice line
    const invoiceLines = await stripe.invoices.listLineItems(
        invoice.id,
        {
            limit: 100
        }
    );

    const matchingLines = invoiceLines.data.filter((line) => {
        const priceId = getId(line.pricing?.price_details?.price || line.price);

        return priceId === getId(stripeSubscription.items?.data?.[0]?.price);
    });

    if(matchingLines.length !== 1){
        throw new Error("Unable to verify subscription invoice line.");
    }

    const line = matchingLines[0];

    const periodStart = line.period?.start;
    const periodEnd = line.period?.end;

    if(!Number.isInteger(periodStart) || !Number.isInteger(periodEnd) || periodEnd <= periodStart){
        throw new Error("Invalid invoice billing period.");
    }

    const start = new Date(periodStart * 1000);
    const end = new Date(periodEnd * 1000);

    const paidAmount = Number(invoice.amount_paid) / 100;

    const expectedAmount = Math.round(
        Number(membership.checkoutAmount) * 100
    );

    if(!Number.isSafeInteger(expectedAmount) || Math.round(paidAmount * 100) !== expectedAmount){
        throw new Error("Membership invoice amount mismatch.");
    }

    if(["cancelled", "expired"].includes(membership.status)){
        throw new Error("Membership is already terminated.");
    }

    // Atomically save the paid invoice and update membership status.
    // Stripe API verification must happen before this transaction.
    const dbSession = await mongoose.startSession();

    try {
        await dbSession.withTransaction(async () => {

            // Read the latest membership state inside the transaction.
            const currentMembership = await subscriptionModel.findById(membership._id).session(dbSession);

            if(!currentMembership){
                throw new Error("Membership not found.");
            }

            // Do not revive terminated memberships.
            if(["cancelled", "expired"].includes(currentMembership.status)){
                throw new Error("Membership is already terminated.");
            }

            // Prevent linking a different Stripe subscription.
            if(currentMembership.stripeSubscriptionId && currentMembership.stripeSubscriptionId !== subscriptionId){
                throw new Error("Stripe subscription mismatch.");
            }

            // Save exactly one payment history record per invoice.
            await subscriptionPaymentModel.updateOne(
                {
                    stripeInvoiceId: invoice.id
                },
                {
                    $set: {
                        paymentStatus: "Paid",
                        amount: paidAmount,
                        currency: "USD",
                        billingReason: invoice.billing_reason || "",
                        periodStart: start,
                        periodEnd: end,
                        paidAt: invoice.status_transitions?.paid_at
                            ? new Date(invoice.status_transitions.paid_at * 1000)
                            : new Date(),
                        hostedInvoiceUrl: invoice.hosted_invoice_url || "",
                        invoicePdfUrl: invoice.invoice_pdf || ""
                    },
                    $setOnInsert: {
                        userId: membership.userId,
                        subscriptionId: membership._id,
                        planId: membership.planId,
                        stripeSubscriptionId: subscriptionId
                    }
                },
                {
                    upsert: true,
                    runValidators: true,
                    session: dbSession
                }
            );

            const existingEnd = currentMembership.currentPeriodEnd;

            // An older invoice must not shorten an already paid period.
            const isOlderPeriod = existingEnd && end.getTime() < existingEnd.getTime();

            // An active membership with the same paid period does not need to be activated again.
            const isAlreadyActive = currentMembership.status === "active" && currentMembership.paymentStatus === "Paid" && existingEnd && end.getTime() === existingEnd.getTime();

            if(isOlderPeriod || isAlreadyActive){
                return;
            }

            // Activate a new paid period or recover a past_due period.
            const updatedMembership = await subscriptionModel.findOneAndUpdate(
                {
                    _id: membership._id,

                    stripeSubscriptionId: {
                        $in: ["", subscriptionId]
                    },

                    status: {
                        $in: ["pending", "active", "past_due"]
                    },

                    $or: [
                        {
                            currentPeriodEnd: null
                        },
                        {
                            currentPeriodEnd: {
                                $lt: end
                            }
                        },
                        {
                            status: "past_due",
                            currentPeriodEnd: end
                        }
                    ]
                },
                {
                    $set: {
                        stripeSubscriptionId: subscriptionId,
                        stripeCustomerId: getId(
                            stripeSubscription.customer
                        ),
                        paymentStatus: "Paid",
                        status: "active",
                        startDate: currentMembership.startDate || start,
                        currentPeriodStart: start,
                        currentPeriodEnd: end,
                        paidAmount,
                        paidCurrency: "USD",
                        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end === true
                    }
                },
                {
                    returnDocument: "after",
                    runValidators: true,
                    session: dbSession
                }
            );

            // Do not silently commit payment history when activation fails.
            if(!updatedMembership){
                throw new Error("Membership activation failed during invoice reconciliation.");
            }
        });
    } finally {
        await dbSession.endSession();
    }

    console.log(`QuickTaste membership invoice processed: ${invoice.id}`);
};

// Failed recurring invoice payment
const handleInvoiceFailed = async (stripe, invoiceEvent) => {
    const subscriptionId = getInvoiceSubscriptionId(invoiceEvent);

    if(!subscriptionId){
        return;
    }

    // Retrieve the latest invoice status from Stripe
    const invoice = await stripe.invoices.retrieve(invoiceEvent.id);

    const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);

    // Ignore unrelated subscriptions
    if(stripeSubscription.metadata?.paymentType !== "membership"){
        return;
    }

    const membership = await findMembership(stripeSubscription);

    await verifyPlan(stripe, membership, stripeSubscription);

    // Verify invoice ownership
    if(getId(invoice.customer) !== getId(stripeSubscription.customer)){
        throw new Error("Stripe invoice customer mismatch.");
    }

    // If the invoice has since been paid, do not mark it failed.
    // Let invoice.paid process the successful payment.
    if(invoice.status === "paid"){
        return;
    }

    if(invoice.currency !== "usd"){
        throw new Error("Unexpected invoice currency.");
    }

    // Find the recurring subscription line in this invoice
    const subscriptionLine = invoice.lines?.data?.find((line) => {
        return(
            line.parent?.type === "subscription_item_details" && getId(line.parent?.subscription_item_details?.subscription) === subscriptionId
        );
    });

    // Read the actual Stripe billing period.
    // Do not use the server's current date for Test Clock invoices.
    if(!Number.isInteger(subscriptionLine?.period?.start) || !Number.isInteger(subscriptionLine?.period?.end) || subscriptionLine.period.end <= subscriptionLine.period.start){
        throw new Error("Invalid failed invoice billing period.");
    }

    const failedPeriodStart = new Date(subscriptionLine.period.start * 1000);
    const failedPeriodEnd = new Date(subscriptionLine.period.end * 1000);

    // Save failed payment history without duplicating invoices
    await subscriptionPaymentModel.updateOne(
        {
            stripeInvoiceId: invoice.id
        },
        {
            $setOnInsert: {
                userId: membership.userId,
                subscriptionId: membership._id,
                planId: membership.planId,
                stripeSubscriptionId: subscriptionId,
                amount: Number(invoice.amount_due) / 100,
                currency: "USD",
                paymentStatus: "Failed",
                billingReason: invoice.billing_reason || "",
                periodStart: failedPeriodStart,
                periodEnd: failedPeriodEnd,
                failedAt: new Date(),
                hostedInvoiceUrl: invoice.hosted_invoice_url || "",
                invoicePdfUrl: invoice.invoice_pdf || ""
            }
        },
        {
            upsert: true,
            runValidators: true
        }
    );

    // Update membership only for the latest failed invoice
    if(stripeSubscription.status === "past_due"){
        const latestInvoiceId = typeof stripeSubscription.latest_invoice === "string" ? stripeSubscription.latest_invoice : stripeSubscription.latest_invoice?.id;

        if(latestInvoiceId === invoice.id){
            await subscriptionModel.updateOne(
                {
                    _id: membership._id,

                    stripeSubscriptionId: {
                        $in: ["", subscriptionId]
                    },

                    status: {
                        $in: ["pending", "active", "past_due"]
                    }
                },
                {
                    $set: {
                        status: "past_due",
                        paymentStatus: "Failed"
                    }
                }
            );
        }
    }
    console.log(`QuickTaste membership payment failure recorded: ${invoice.id}`);
};

// Synchronize Stripe subscription status and cancellation settings
const handleSubscriptionUpdated = async (stripe, eventSubscription) => {
    const stripeSubscription = await stripe.subscriptions.retrieve(eventSubscription.id);

    // Ignore subscriptions unrelated to QuickTaste memberships
    if(stripeSubscription.metadata?.paymentType !== "membership"){
        return;
    }

    const membership = await findMembership(stripeSubscription);

    const stripeStatus = stripeSubscription.status;

    const updates = {
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end === true
    };

    // Cancellation is scheduled, not completed.
    if(stripeStatus === "active"){
        // A successful paid invoice controls activation.
        // Do not activate a pending or past_due membership here.
        if(membership.status === "active"){
            updates.status = "active";
        }
    }

    // Payment is overdue
    if(stripeStatus === "past_due"){
        if(["pending", "active", "past_due"].includes(membership.status)){
            updates.status = "past_due";
            updates.paymentStatus = "Failed";
        }
    }

    // Stripe ended the subscription
    if(stripeStatus === "canceled"){
        updates.status = "cancelled";
        updates.cancelAtPeriodEnd = false;

        updates.cancelledAt = stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000) : new Date();
    }

    // Handle subscriptions Stripe marks unpaid or incomplete_expired.
    // Do not grant membership access.
    if(["unpaid", "incomplete_expired"].includes(stripeStatus)){
        if(["pending", "active", "past_due"].includes(membership.status)){
            updates.status = "past_due";
            updates.paymentStatus = "Failed";
        }
    }

    await subscriptionModel.updateOne(
        {
            _id: membership._id,
            stripeSubscriptionId: {
                $in: ["", stripeSubscription.id]
            }
        },
        {
            $set: updates
        }
    );

    console.log(`QuickTaste membership subscription synchronized: ${stripeSubscription.id}`);
};

// Stripe confirms that a subscription has ended
const handleSubscriptionDeleted = async (stripeSubscription) => {
    if(stripeSubscription.metadata?.paymentType !== "membership"){
        return;
    }

    const membership = await findMembership(stripeSubscription);

    const actualCancellationDate = stripeSubscription.ended_at ? new Date(stripeSubscription.ended_at * 1000) : stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000) : new Date();

    await subscriptionModel.updateOne(
        {
            _id: membership._id,
            status: {
                $in: ["pending", "active", "past_due", "cancelled"]
            }
        },
        {
            $set: {
                status: "cancelled",
                cancelAtPeriodEnd: false,
                cancelledAt: actualCancellationDate
            }
        }
    );

    console.log(`QuickTaste membership subscription cancelled: ${stripeSubscription.id}`);
};

// Stripe webhook endpoint
export const subscriptionStripeWebhook = async (req, res) => {
    let stripe;
    let event;

    try {
        stripe = getStripe();

        const webhookSecret = process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET;

        if(!webhookSecret){
            throw new Error("Subscription webhook secret is not configured.");
        }

        const signature = req.headers["stripe-signature"];

        if(!signature){
            return res.status(400).send(
                "Missing Stripe signature."
            );
        }

        event = stripe.webhooks.constructEvent(
            req.body,
            signature,
            webhookSecret
        );

    } catch (error) {
        console.error("Subscription Webhook Signature Error:", error.message);

        return res.status(400).send("Invalid subscription webhook signature.");
    }

    try {
        switch(event.type){
            case "checkout.session.completed" : await handleCheckoutCompleted(stripe, event.data.object);
            break;

            case "invoice.paid" : await handleInvoicePaid(stripe, event.data.object);
            break;

            case "invoice.payment_failed" : await handleInvoiceFailed(stripe, event.data.object);
            break;

            case "customer.subscription.updated" : await handleSubscriptionUpdated(stripe, event.data.object);
            break;

            case "customer.subscription.deleted" : await handleSubscriptionDeleted(event.data.object);
            break;

            default : break;
        }

        return res.status(200).json({
            received: true
        });
        
    } catch (error) {
        console.error("Subscription Webhook Processing Error:", error);

        // Allow Stripe to retry failed processing.
        return res.status(500).send("Unable to process subscription webhook.");
    }
}