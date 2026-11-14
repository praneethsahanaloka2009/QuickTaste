import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema({
    
    // Customer who owns the subscription
    userId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "user",
        required: true
    },

    // Selected membership plan
    planId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "membershipPlan",
        required : true
    },

    // Stripe customer information
    stripeCustomerId : {
        type : String,
        default : ""
    },

    // Stripe recurring subscription ID
    stripeSubscriptionId : {
        type : String,
        default : ""
    },

    // Stripe one-time Checkout Session ID
    stripeCheckoutSessionId : {
        type : String,
        default : ""
    },

    // Stripe Payment Intent ID
    stripePaymentIntentId : {
        type : String,
        default : ""
    },

    // Actual amount paid for this membership
    paidAmount : {
        type : Number,
        default : 0,
        min : 0
    },

    // Currency used for the payment
    paidCurrency : {
        type : String,
        default : "USD",
        uppercase: true,
        trim: true
    },

    // Membership price at the time of checkout
    checkoutAmount : {
        type : Number,
        default : 0,
        min : 0
    },

    // Currency at the time of checkout
    checkoutCurrency : {
        type : String,
        default : "USD",
        uppercase: true,
        trim: true
    },

    // Membership payment status
    paymentStatus : {
        type : String,
        enum : ["Pending", "Paid", "Failed", "Refunded"],
        default : "Pending"
    },

    // Membership status
    status : {
        type : String,
        enum : ["pending", "active", "past_due", "cancelled", "expired"],
        default : "pending"
    },

    // First activation date
    startDate : {
        type : Date,
        default : null
    },

    // Current billing period start
    currentPeriodStart : {
        type : Date,
        default : null
    },

    // Current billing period end
    currentPeriodEnd : {
        type : Date,
        default : null
    },

    // Stop automatic renewal at period end
    cancelAtPeriodEnd : {
        type : Boolean,
        default : false
    },

    // Date customer requested cancellation
    cancelledAt : {
        type : Date,
        default : null
    },

    // Total money saved using membership
    totalSavings : {
        type : Number,
        default : 0,
        min : 0
    }

},{
    timestamps : true
});

// Prevent processing the same Stripe Checkout twice
subscriptionSchema.index(
    {
        stripeCheckoutSessionId : 1
    },
    {
        unique : true,
        partialFilterExpression : {
            stripeCheckoutSessionId : {
                $type : "string",
                $gt : ""
            }
        }
    }
);

// Find a customer's subscriptions efficiently
subscriptionSchema.index({
    userId : 1,
    status : 1
});

// Prevent duplicate Stripe subscriptions
subscriptionSchema.index(
    {
        stripeSubscriptionId : 1
    },
    {
        unique : true,
        partialFilterExpression : {
            stripeSubscriptionId : {
                $type : "string",
                $gt : ""
            }
        }
    }
);

// Prevent multiple simultaneous active memberships
subscriptionSchema.index(
    {
        userId : 1
    },
    {
        name: "unique_active_membership_per_user",
        unique : true,
        partialFilterExpression : {
            status : "active"
        }
    }
);

// Find pending membership purchases efficiently
subscriptionSchema.index({
    userId: 1,
    status: 1,
    paymentStatus: 1
});

// Allow only one unresolved checkout per customer
subscriptionSchema.index(
    {
        userId: 1
    },
    {
        name: "unique_pending_membership_per_user",
        unique: true,
        partialFilterExpression: {
            status: "pending",
            paymentStatus: "Pending"
        }
    }
);

const subscriptionModel = mongoose.models.subscription || mongoose.model("subscription", subscriptionSchema);

export default subscriptionModel;