import mongoose from "mongoose";

const codSettlementSchema = new mongoose.Schema({

    // Branch receiving the COD cash
    branchId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "branch",
        required : true
    },

    // Rider handing over the cash
    riderId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "rider",
        required : true
    },

    // Business date of the settlement
    settlementDate : {
        type : Date,
        required : true
    },

    // Orders included in this settlement
    orders : [
        {
            type : mongoose.Schema.Types.ObjectId,
            ref : "order"
        }
    ],

    // Total COD cash expected from the rider
    expectedAmount : {
        type : Number,
        required : true,
        min : 0
    },

    // Actual amount received by the branch
    receivedAmount : {
        type : Number,
        default : 0,
        min : 0
    },

    // Settlement status
    status : {
        type : String,
        enum : [
            "Pending",
            "Settled"
        ],
        default : "Pending"
    },

    // Admin who confirmed the cash receipt
    settledBy : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "admin",
        default : null
    },

    // Date and time cash was confirmed
    settledAt : {
        type : Date,
        default : null
    },

    // Optional settlement notes
    notes : {
        type : String,
        default : ""
    }

},{
    timestamps : true
});

// Helps retrieve a rider's daily settlements
codSettlementSchema.index({
    branchId : 1,
    riderId : 1,
    settlementDate : -1
});

// Prevents the same order being included in multiple settlement batches.
codSettlementSchema.index(
    {
        orders : 1
    },
    {
        unique : true,
        partialFilterExpression : {
            orders : { $type: "objectId" }
        }
    }
);

const codSettlementModel = mongoose.models.codSettlement || mongoose.model("codSettlement", codSettlementSchema);

export default codSettlementModel;