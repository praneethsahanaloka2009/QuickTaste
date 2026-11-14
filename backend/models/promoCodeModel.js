
import mongoose from "mongoose"

const promoCodeSchema = new mongoose.Schema({

    // Promo code
    code : {
        type : String,
        required : true,
        unique : true,
        uppercase : true,
        trim : true
    },

    // First Discount Type
    discountType : {
        type : String,
        enum : ["percentage", "fixed", "freeDelivery"],
        required : true
    },

    // First Discount Value
    discountValue : {
        type : Number,
        required : true,
        min : 0
    },

    // Second Discount Type (Optional)
    discountType2 : {
        type : String,
        enum : ["percentage", "fixed", "freeDelivery"],
        default : null
    },

    // Second Discount Value (Optional)
    discountValue2 : {
        type : Number,
        min : 0,
        default : null
    },

    // Minimum order amount
    minOrderAmount : {
        type : Number,
        default : 0,
        min : 0
    },

    // Maximum discount for first offer
    maxDiscountAmount : {
        type : Number,
        default : null,
        min : 0
    },

    // Maximum discount for second offer
    maxDiscountAmount2 : {
        type : Number,
        default : null,
        min : 0
    },

    // Expiry date
    expiryDate : {
        type : Date,
        required : true
    },

    // Maximum usage limit
    usageLimit : {
        type : Number,
        default : null,
        min : 1
    },

    // Number of times used
    usedCount : {
        type : Number,
        default : 0,
        min : 0
    },

    // Enable / Disable promo
    isActive : {
        type : Boolean,
        default : true
    },

    // Offer Bar text
    offerText : {
        type : String,
        trim : true,
        default : ""
    },

    // Show / Hide on Offer Bar
    showOnOfferBar : {
        type : Boolean,
        default : false
    }

}, {
    timestamps : true
})

const promoCodeModel = mongoose.models.promoCode || mongoose.model("promoCode", promoCodeSchema)

export default promoCodeModel;