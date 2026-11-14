import mongoose from "mongoose";

const riderPayoutTransactionSchema = new mongoose.Schema({
    payoutId : {
        type: mongoose.Schema.Types.ObjectId,
        ref: "riderPayout",
        required: true
    },

    riderId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "rider",
        required : true
    },

    branchId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "branch",
        required : true
    },

    amount : {
        type : Number,
        required : true,
        min : 0
    },

    currency : {
        type : String,
        required : true,
        default : "USD"
    },

    environment : {
        type : String,
        enum : ["test"],
        default : "test",
        required : true,
        immutable : true
    },

    provider : {
        type : String,
        enum : ["mock"],
        default : "mock",
        required : true
    },

    status : {
        type : String,
        enum : [
            "Pending",
            "Processing",
            "Succeeded",
            "Failed"
        ],
        default : "Pending"
    },

    idempotencyKey : {
        type : String,
        required : true,
        unique : true
    },

    providerReference : {
        type : String,
        default : ""
    },

    failureReason : {
        type : String,
        default : ""
    },

    initiatedBy : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "admin",
        required : true
    },

    initiatedAt : {
        type : Date,
        default : Date.now
    },

    completedAt : {
        type : Date,
        default : null
    }
},
{
    timestamps : true
});

// Only one active/successful test transfer per payout.
// Failed attempts may be retried with a new transaction.
riderPayoutTransactionSchema.index(
    {
        payoutId : 1
    },
    {
        unique : true,
        partialFilterExpression : {
            status : {
                $in : [
                    "Pending",
                    "Processing",
                    "Succeeded"
                ]
            }
        }
    }
);

riderPayoutTransactionSchema.index({
    riderId: 1,
    createdAt: -1
});

const riderPayoutTransactionModel = mongoose.models.riderPayoutTransaction || mongoose.model("riderPayoutTransaction", riderPayoutTransactionSchema);

export default riderPayoutTransactionModel;