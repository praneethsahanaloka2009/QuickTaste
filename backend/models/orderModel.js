import mongoose from "mongoose";

// Snapshot of an option selected when the order was placed
const selectedOptionSchema = new mongoose.Schema(
    {
        optionId : {
            type : mongoose.Schema.Types.ObjectId,
            default : null
        },

        name : {
            type: String,
            required : true,
            trim : true
        },

        price : {
            type : Number,
            required : true,
            min : 0
        }
    },
    {
        _id : false
    }
);

// Snapshot of a customization group
const selectedCustomizationSchema = new mongoose.Schema(
    {
        groupId : {
            type : mongoose.Schema.Types.ObjectId,
            default : null
        },

        groupName : {
            type : String,
            required : true,
            trim : true
        },

        options : {
            type : [selectedOptionSchema],
            default : []
        }
    },
    {
        _id : false
    }
)

const orderItemSchema = new mongoose.Schema(
    {
        foodId : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "food",
            required : true
        },

        name : {
            type : String,
            required : true
        },

        price : {
            type : Number,
            required : true
        },

        quantity : {
            type : Number,
            required : true,
            min : 1
        },

        preparationTime : {
            type : Number,
            required : true,
            min : 1,
            default : 15
        },

        // Whether this order item has custom selections
        isCustomized : {
            type : Boolean,
            default : false
        },

        // Unique identifier for this food + selections combination
        variantKey : {
            type : String,
            default : ""
        },

        // Base product price at the time of ordering
        basePrice : {
            type : Number,
            default : null,
            min : 0
        },

        // Size and Extra Add-ons selected by the customer
        selectedCustomizations : {
            type : [selectedCustomizationSchema],
            default : []
        }
    },
    {
        _id: false
    }
);

const orderSchema = new mongoose.Schema(
    {
        userId : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "user",
            required : true
        },

        // Branch responsible for preparing this order
        branchId : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "branch",
            default : null
        },

        items : {
            type : [orderItemSchema],
            required : true
        },

        // Food subtotal before discounts
        subtotal : {
            type : Number,
            required : true,
            min : 0
        },

        // Food total after promo discounts
        amount : {
            type : Number,
            required : true,
            min : 0
        },

        // Promo code applied to this order
        promoCode : {
            type : String,
            default : ""
        },

        // Discount applied to food subtotal
        discountAmount : {
            type : Number,
            default : 0,
            min : 0
        },

        // Membership applied to this order
        membershipId : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "subscription",
            default : null
        },

        // Priority preparation for Premium membership orders
        isPriorityOrder : {
            type : Boolean,
            default : false
        },

        // Membership food discount
        membershipFoodDiscount : {
            type : Number,
            default : 0,
            min : 0
        },

        // Membership delivery discount
        membershipDeliverySavings : {
            type : Number,
            default : 0,
            min : 0
        },

        // Total membership savings for this order
        membershipSavings : {
            type : Number,
            default : 0,
            min : 0
        },

        // Prevent counting membership savings more than once
        membershipSavingsCountedAt : {
            type : Date,
            default : null
        },

        // Track membership savings reversal after a full refund
        membershipSavingsReversedAt : {
            type : Date,
            default : null
        },

        // Actual promo food discount
        promoDiscountAmount : {
            type : Number,
            default : 0,
            min : 0
        },

        // Selected promo offer
        selectedOffer : {
            type : Number,
            enum : [1, 2],
            default : 1
        },

        // Discount applied to delivery fee
        deliveryDiscountAmount : {
            type : Number,
            default : 0,
            min : 0
        },

        deliveryFee : {
            type : Number,
            required : true,
            default : 2,
            min : 0
        },

        // Customer delivery address
        address : {
            firstName : {
                type : String,
                required : true
            },

            lastName : {
                type : String,
                required : true
            },

            email : {
                type : String,
                required : true
            },

            street : {
                type : String,
                required : true
            },

            city : {
                type : String,
                required : true
            },

            state : {
                type : String,
                required : true
            },

            zipCode : {
                type : String,
                required : true
            },

            country : {
                type : String,
                required : true
            },

            phone : {
                type : String,
                required : true
            }
        },

        // Customer selected GPS delivery location
        deliveryLocation : {
            latitude : {
                type : Number,
                min : -90,
                max : 90,
                default : null
            },

            longitude : {
                type : Number,
                min : -180,
                max : 180,
                default : null
            }
        },

        // Customer current location confirmation
        customerConfirmedLocation: {
            latitude : {
                type : Number,
                min : -90,
                max : 90,
                default : null
            },

            longitude : {
                type : Number,
                min : -180,
                max : 180,
                default : null
            },

            confirmedAt : {
                type : Date,
                default : null
            }
        },

        // Location confirmation OTP (separate from delivery OTP)
        locationOtpHash : {
            type : String,
            default : undefined,
            select : false
        },

        locationOtpExpiresAt : {
            type : Date,
            default : null
        },

        locationOtpAttempts : {
            type : Number,
            default : 0,
            min : 0
        },

        locationOtpSentAt : {
            type : Date,
            default : null
        },

        locationOtpVerifiedAt : {
            type : Date,
            default : null
        },

        // Location change approval
        locationChangeStatus : {
            type : String,
            enum : [
                "Not Requested",
                "Pending",
                "Approved",
                "Rejected"
            ],
            default : "Not Requested"
        },

        // Payment status
        paymentStatus : {
            type : String,
            enum : [
                "Pending",
                "Paid",
                "Failed",
                "Refunded"
            ],
            default : "Pending"
        },

        // Payment method
        paymentMethod : {
            type : String,
            enum : [
                "Pending",
                "Cash on Delivery",
                "Online Payment",
                "PayHere",
                "Stripe"
            ],
            default : "Pending"
        },

        // PayHere payment details
        payherePaymentId : {
            type : String,
            default : ""
        },

        // Payment amount charged through PayHere in LKR
        payhereAmountLkr : {
            type : Number,
            default : 0,
            min : 0
        },

        // USD to LKR exchange rate used for the payment
        payhereExchangeRate : {
            type : Number,
            default : 0,
            min : 0
        },

        // Currency used for PayHere payment
        payhereCurrency : {
            type : String,
            default : "LKR"
        },

        // Stripe payment details (retained for compatibility)
        stripeSessionId : {
            type : String,
            unique : true,
            sparse : true
        },

        stripePaymentIntentId : {
            type : String,
            default : "",
            sparse : true
        },

        // Refund details
        refundStatus : {
            type : String,
            enum : [
                "Not Requested",
                "Pending",
                "Processing",
                "Refunded",
                "Failed"
            ],
            default : "Not Requested"
        },

        refundAmount : {
            type : Number,
            default : 0,
            min : 0
        },

        stripeRefundId : {
            type : String,
            default : null
        },

        refundRequestedAt : {
            type : Date,
            default : null
        },

        refundedAt : {
            type : Date,
            default : null
        },

        refundReason : {
            type : String,
            default : ""
        },

        // Assigned rider
        assignedRider : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "rider",
            default : null
        },

        // Delivery distance in kilometers
        deliveryDistanceKm : {
            type : Number,
            default : null,
            min : 0
        },

        // Rider earning for this delivery
        riderEarning : {
            type : Number,
            default : null,
            min : 0
        },

        // When rider earning was calculated
        riderEarningCalculatedAt : {
            type : Date,
            default : null
        },

        // Customer delivery OTP verification
        deliveryOtpHash : {
            type : String,
            default : undefined,
            select : false
        },

        deliveryOtpExpiresAt : {
            type : Date,
            default : null
        },

        deliveryOtpAttempts : {
            type : Number,
            default : 0,
            min : 0
        },

        deliveryOtpSentAt : {
            type : Date,
            default : null
        },

        deliveryOtpVerifiedAt : {
            type : Date,
            default : null
        },

        // Rider delivery confirmation
        riderDeliveryConfirmedAt : {
            type : Date,
            default : null
        },

        // COD cash collection confirmation
        riderCashCollected : {
            type : Boolean,
            default : false
        },

        riderCashCollectedAt : {
            type : Date,
            default : null
        },

        riderCashCollectedAmount : {
            type : Number,
            default : 0,
            min : 0
        },

        // Order status
        orderStatus : {
            type: String,
            enum : [
                "Pending",
                "Processing",
                "Out for Delivery",
                "Delivered",
                "Cancelled"
            ],
            default : "Pending"
        },

        // Actual delivery completion date
        deliveredAt : {
            type : Date,
            default : null
        },

        preparationStartedAt : {
            type : Date,
            default : null
        },

        // Cancellation details
        cancelledBy : {
            type : String,
            enum : [
                "Customer",
                "Admin"
            ],
            required : false
        },

        cancellationReason : {
            type : String,
            required : false
        },

        cancelledAt : {
            type : Date,
            required : false
        }
    },
    {
        timestamps : true
    }
);

const orderModel = mongoose.models.order || mongoose.model("order", orderSchema);

export default orderModel;