import mongoose from "mongoose";

const riderEarningsSettingsSchema = new mongoose.Schema({

    key : {
        type : String,
        required : true,
        unique : true,
        default: "global"
    },

    defaultEarning : {
        type : Number,
        required : true,
        default : 2,
        min : 0
    },

    currency : {
        type : String,
        enum : ["USD"],
        default : "USD"
    },

    updatedBy : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "admin",
        default : null
    }
    
},{
    timestamps : true
});

const riderEarningsSettingsModel = mongoose.models.riderEarningsSettings || mongoose.model("riderEarningsSettings", riderEarningsSettingsSchema);

export default riderEarningsSettingsModel;