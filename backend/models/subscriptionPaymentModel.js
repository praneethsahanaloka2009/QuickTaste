import mongoose from "mongoose";

const subscriptionPaymentSchema = new mongoose.Schema({

    // Customer who made the payment
    userId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "user",
        required : true
    },
    
    // Membership subscription
    subscriptionId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "subscription",
        required : true
    },

    // Purchased membership plan
    planId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "membershipPlan",
        required : true
    },

    // Stripe recurring subscription ID
    stripeSubscriptionId : {
        type : String,
        required : true,
        trim : true
    },

    // Unique Stripe invoice ID
    stripeInvoiceId : {
        type : String,
        required : true,
        unique : true,
        trim : true
    },

    // Stripe Payment Intent ID (when available)
    stripePaymentIntentId : {
        type : String,
        default : "",
        trim : true
    },

    // Amount in USD (not cents)
    amount : {
        type : Number,
        required : true,
        min : 0
    },

    // Payment currency
    currency : {
        type : String,
        required : true,
        default : "USD",
        uppercase : true,
        trim : true
    },

    // Invoice payment status
    paymentStatus : {
        type : String,
        enum : ["Pending", "Paid", "Failed", "Refunded"],
        default : "Pending"
    },

    // Stripe invoice billing reason
    billingReason : {
        type : String,
        default : ""
    },

    // Billing period start
    periodStart : {
        type : Date,
        default : null
    },

    // Billing period end
    periodEnd : {
        type : Date,
        default : null
    },

    // Date payment succeeded
    paidAt : {
        type : Date,
        default : null
    },

    // Date payment failed
    failedAt : {
        type : Date,
        default : null
    },

    // Date refund was recorded
    refundedAt : {
        type : Date,
        default : null
    },

    // Stripe invoice hosted URL
    hostedInvoiceUrl : {
        type : String,
        default : ""
    },

    // Stripe invoice PDF URL
    invoicePdfUrl : {
        type : String,
        default : ""
    }

},{
    timestamps : true
});

// Find customer payment history
subscriptionPaymentSchema.index({
    userId : 1,
    createdAt : -1
});

// Find payments belonging to one membership
subscriptionPaymentSchema.index({
    subscriptionId : 1,
    createdAt : -1
});

// Find invoices belonging to a Stripe subscription
subscriptionPaymentSchema.index({
    stripeSubscriptionId : 1,
    createdAt : -1
});

// Find payments by status
subscriptionPaymentSchema.index({
    paymentStatus : 1,
    createdAt : -1
});

const subscriptionPaymentModel = mongoose.models.subscriptionPayment || mongoose.model("subscriptionPayment", subscriptionPaymentSchema);

export default subscriptionPaymentModel;