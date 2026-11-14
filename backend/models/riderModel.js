import mongoose from "mongoose";

const riderSchema = new mongoose.Schema({
    name : {
        type : String,
        required : false,
        trim : true,
        default : ""
    },

    email : {
        type : String,
        required : true,
        unique : true,
        lowercase : true,
        trim : true
    },

    password : {
        type : String,
        required : false,
        trim : true,
        default : ""
    },

    vehicleType : {
        type : String,
        enum : ["Motorcycle", "Bicycle", "Scooter", "Other"],
        default : "Motorcycle"
    },

    isActive : {
        type : Boolean,
        default : true
    },

    avatar : {
        type : String,
        default : ""
    },

    // Rider Bank Account Details
    bankDetails : {
        bankName : {
            type : String,
            trim : true,
            default : ""
        },

        accountHolderName : {
            type : String,
            trim : true,
            default : ""
        },

        accountNumber : {
            type : String,
            trim : true,
            default : "",
            select : false
        },

        branchName : {
            type : String,
            trim : true,
            default : ""
        }
    },
},{
    timestamps : true
})

const riderModel = mongoose.models.rider || mongoose.model("rider", riderSchema);

export default riderModel;