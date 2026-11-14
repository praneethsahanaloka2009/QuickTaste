import mongoose from "mongoose";

const riderPayoutSchema = new mongoose.Schema({
    // Branch responsible for paying the rider
    branchId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "branch",
        required : true
    },

    // Rider receiving the payout
    riderId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "rider",
        required : true
    },

    // Orders included in this payout
    orders : {
        type : [
            {
                type : mongoose.Schema.Types.ObjectId,
                ref : "order"
            }
        ],
        required : true,
        validate : {
            validator : (orders) => Array.isArray(orders) && orders.length > 0 && new Set(orders.map(String)).size === orders.length,
            message : "Payout must contain unique orders."
        }
    },

    // Total rider earnings included in the payout
    totalAmount : {
        type : Number,
        required : true,
        min : 0
    },

    // Payout status
    status : {
        type : String,
        enum : ["Pending", "Processing", "Paid", "Failed"],
        default : "Pending"
    },

    // Manual or simulated automatic payout
    payoutMode : {
        type : String,
        enum : ["Manual", "Automatic Test"],
        default : "Manual"
    },

    // Payment environment
    environment : {
        type : String,
        enum : ["manual", "test"],
        default : "manual"
    },

    // Payment method
    paymentMethod : {
        type : String,
        enum : ["Cash", "Bank Transfer", "Other"],
        default : null
    },

    // Admin who confirmed payment
    paidBy : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "admin",
        default : null
    },

    // Actual payment date
    paidAt : {
        type : Date,
        default : null
    },

    // Optional payment reference
    paymentReference : {
        type : String,
        trim : true,
        default : ""
    },

    // Additional notes
    notes : {
        type : String,
        trim : true,
        default : ""
    }
},{
    timestamps : true
});

// Prevent the same order from being included in multiple rider payouts.
riderPayoutSchema.index(
    {
        orders : 1
    },
    {
        unique : true
    }
);

// Improve payout listing performance.
riderPayoutSchema.index({
    branchId : 1,
    riderId : 1,
    status : 1,
    createdAt : -1
});

// Improve test payout queries
riderPayoutSchema.index({
    payoutMode: 1,
    environment: 1,
    status: 1
});

const riderPayoutModel = mongoose.models.riderPayout || mongoose.model("riderPayout", riderPayoutSchema);

export default riderPayoutModel;