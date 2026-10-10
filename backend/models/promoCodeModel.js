import mongoose from "mongoose"

const promoCodeSchema = new mongoose.Schema({
    
    // Promo code
    code : {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },

    // Discount type
    discountType : {
        type: String,
        enum: ["percentage", "fixed"],
        required: true
    },

    // Discount value.
    // Example:
    // 10 = 10%
    // 5 = $5
    discountValue : {
        type: Number,
        required: true,
        min: 0
    },

    // Minimum order amount
    minOrderAmount : {
        type: Number,
        default: 0,
        min: 0
    },

    // Maximum discount
    // Mainly useful for percentage discounts
    maxDiscountAmount: {
        type: Number,
        default: null,
        min: 0
    },

    // Expiry date
    expiryDate : {
        type: Date,
        required: true
    },

    // Maximum number of times this promo can be used
    usageLimit : {
        type: Number,
        default: null,
        min: 1
    },

    // Number of times already used
    usedCount : {
        type: Number,
        default: 0,
        min: 0
    },

    // Enable / Disable promo
    isActive: {
        type: Boolean,
        default: true
    },

    // Text displayed on the OfferBar
    offerText : {
        type: String,
        trim: true,
        default: ""
    },

    // Show / Hide this promo on the OfferBar
    showOnOfferBar : {
        type: Boolean,
        default: false
    }

},{
    timestamps: true
})

const promoCodeModel = mongoose.models.promoCode || mongoose.model("promoCode", promoCodeSchema)

export default promoCodeModel;