import mongoose from "mongoose";

const membershipPlanSchema = new mongoose.Schema({
    
    name : {
        type : String,
        required : true,
        unique : true,
        enum : ["Basic", "Plus", "Premium"]
    },

    price : {
        type : Number,
        required : true,
        min : 0
    },

    currency : {
        type : String,
        default : "USD",
        uppercase : true,
        trim : true
    },

    billingInterval : {
        type : String,
        enum : ["month"],
        default : "month",
        required: true
    },

    description : {
        type : String,
        default : ""
    },

    deliveryDiscountPercentage : {
        type : Number,
        default : 0,
        min : 0,
        max : 100
    },

    foodDiscountPercentage : {
        type : Number,
        default : 0,
        min : 0,
        max : 100
    },

    benefits : {
        type : [String],
        default : []
    },

    stripePriceId : {
        type : String,
        default : ""
    },

    isActive : {
        type : Boolean,
        default : true
    }

},{
    timestamps : true
});

// Prevent duplicate Stripe Price IDs
membershipPlanSchema.index(
    {
        stripePriceId : 1
    },
    {
        unique : true,
        partialFilterExpression : {
            stripePriceId : {
                $type : "string",
                $gt : ""
            }
        }
    }
);

const membershipPlanModel = mongoose.models.membershipPlan || mongoose.model("membershipPlan", membershipPlanSchema);

export default membershipPlanModel;