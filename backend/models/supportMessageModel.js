import mongoose from "mongoose";

const supportMessageSchema = new mongoose.Schema({
    
    conversationId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "supportConversation",
        required : true,
        index : true
    },

    senderType : {
        type : String,
        enum : ["customer", "ai", "admin", "system"],
        required : true
    },

    senderId : {
        type : mongoose.Schema.Types.ObjectId,
        default : null
    },

    message : {
        type : String,
        required : true,
        trim : true,
        minlength : 1,
        maxlength : 2000
    },

    isRead : {
        type : Boolean,
        default : false
    }

},{
    timestamps : true
});

supportMessageSchema.index({
    conversationId : 1,
    createdAt : 1
});

const supportMessageModel = mongoose.models.supportMessage || mongoose.model("supportMessage", supportMessageSchema);

export default supportMessageModel;