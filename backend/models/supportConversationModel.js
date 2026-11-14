import mongoose from "mongoose";

const supportConversationSchema = new mongoose.Schema({

    customerId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "user",
        required : true,
        unique : true,
        index : true
    },

    mode : {
        type : String,
        enum : ["ai", "human"],
        default : "ai"
    },

    status : {
        type : String,
        enum : ["open", "closed"],
        default : "open"
    },

    assignedAdmin : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "admin",
        default : null
    },

    lastMessage : {
        type : String,
        default : "",
        maxlength : 2000
    },

    lastMessageAt : {
        type : Date,
        default : Date.now
    },

    customerUnreadCount : {
        type : Number,
        default : 0,
        min : 0
    },

    adminUnreadCount : {
        type : Number,
        default : 0,
        min : 0
    }

},{
    timestamps: true
});

supportConversationSchema.index({
    lastMessageAt: -1
});

const supportConversationModel = mongoose.models.supportConversation || mongoose.model("supportConversation", supportConversationSchema);

export default supportConversationModel;