import mongoose from "mongoose";

const savedAddressSchema = new mongoose.Schema({

    label : {
        type : String,
        enum : ["Home", "Work", "Other"],
        required : true
    },

    fullAddress : {
        type : String,
        required : true,
        trim : true
    },

    city : {
        type : String,
        required : true,
        trim : true
    },

    state : {
        type : String,
        default : "",
        trim : true
    },

    zipCode : {
        type : String,
        default : "",
        trim : true
    },

    country : {
        type : String,
        default : "Sri Lanka",
        trim : true
    },

    latitude : {
        type : Number,
        required : true,
        min : -90,
        max : 90
    },

    longitude : {
        type : Number,
        required : true,
        min : -180,
        max : 180
    },

    isDefault : {
        type : Boolean,
        default : false
    }

},{
    timestamps : true
});

const userSchema = new mongoose.Schema({

    name : {
        type : String,
        required : true,
        trim : true
    },

    email : {
        type : String,
        required : true,
        unique : true,
        trim : true,
        lowercase : true
    },

    password : {
        type : String,
        required : false
    },

    phone : {
        type : String,
        default : "",
        trim : true
    },

    avatar : {
        type : String,
        default : ""
    },

    savedAddresses : {
        type : [savedAddressSchema],
        default : []
    },
    
    cartData : {
        type : Object,
        default : {}
    },

    customizedCartData : {
        type : [mongoose.Schema.Types.Mixed],
        default : []
    }
    
},{
    minimize : false,
    timestamps : true
})

const userModel = mongoose.models.user || mongoose.model("user", userSchema);

export default userModel;