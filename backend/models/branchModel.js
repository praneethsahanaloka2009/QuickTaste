import mongoose from "mongoose";

const branchSchema = new mongoose.Schema({

    name : {
        type : String,
        required : true,
        trim : true
    },

    code : {
        type : String,
        required : true,
        unique : true,
        uppercase : true,
        trim : true
    },

    province : {
        type : String,
        required : true,
        trim : true
    },

    city : {
        type : String,
        required : true,
        trim : true
    },

    address : {
        type : String,
        default : "",
        trim : true
    },

    phone : {
        type : String,
        default : "",
        trim : true
    },

    email : {
        type : String,
        default : "",
        trim : true,
        lowercase : true
    },

    location : {
        latitude : {
            type : Number,
            default : null,
            min : -90,
            max : 90
        },

        longitude : {
            type : Number,
            default : null,
            min : -180,
            max : 180
        }
    },

    // Maximum supported delivery distance
    deliveryRadiusKm : {
        type : Number,
        default : 10,
        min : 0
    },

    // Only active branches can accept orders
    isActive : {
        type : Boolean,
        default : false
    },

    // Planned branches must not accept orders
    status : {
        type : String,
        enum : [
            "Planned",
            "Operational",
            "Temporarily Closed"
        ],
        default : "Planned"
    }
    
},{
    timestamps : true
})

branchSchema.index({ province: 1, city: 1 });

const branchModel = mongoose.models.branch || mongoose.model("branch", branchSchema);

export default branchModel;