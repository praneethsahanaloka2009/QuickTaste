import mongoose from "mongoose";
import supportConversationModel from "../models/supportConversationModel.js";
import supportMessageModel from "../models/supportMessageModel.js";
import { emitSupportEvent } from "../config/socket.js";
import { generateGeminiSupportReply } from "../services/geminiSupportService.js";
import { generateRuleBasedReply } from "../services/ruleBasedSupportService.js";
import { getSupportOrderContext } from "../services/supportOrderService.js";

const MAX_MESSAGE_LENGTH = 2000;
const MESSAGE_LIMIT = 100;

// Validate a chat message
const validateMessage = (message) => {
    if(typeof message !== "string"){
        return null;
    }

    const cleaned = message.trim();

    if(cleaned.length === 0 || cleaned.length > MAX_MESSAGE_LENGTH){
        return null;
    }

    return cleaned;
};

// Customer : Start Support Conversation
const startSupportConversation = async (req, res) => {
    try {
        const customerId = req.userId;

        if(!mongoose.isValidObjectId(customerId)){
            return res.status(401).json({
                success: false,
                message: "Invalid customer authentication."
            });
        }

        const conversation = await supportConversationModel.findOneAndUpdate(
            {
                customerId
            },
            {
                $setOnInsert: {
                    customerId,
                    mode: "ai",
                    status: "open"
                }
            },
            {
                upsert: true,
                returnDocument: "after",
                runValidators: true,
                setDefaultsOnInsert: true
            }
        );

        return res.status(200).json({
            success: true,
            message: "Support conversation ready.",
            conversation
        });

    } catch (error) {
        console.error("Start Support Conversation Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to start support conversation."
        });
    }
};

// Customer : Get chat history
const getCustomerSupportMessages = async (req, res) => {
    try {
        const conversation = await supportConversationModel.findOne({ customerId: req.userId });

        if(!conversation){
            return res.status(200).json({
                success: true,
                conversation: null,
                messages: []
            });
        }

        const messages = await supportMessageModel.find({ conversationId: conversation._id }).sort({ createdAt: -1, _id: -1 }).limit(MESSAGE_LIMIT).lean();

        return res.status(200).json({
            success: true,
            conversation,
            messages: messages.reverse()
        });
    } catch (error) {
        console.error("Get Customer Support Messages Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to load support messages."
        });
    }
};

// Customer : Send Message
const sendCustomerSupportMessage = async (req, res) => {
    try {
        const message = validateMessage(req.body?.message);

        if(!message){
            return res.status(400).json({
                success: false,
                message: "Message must contain 1 to 2000 characters."
            });
        }

        const conversation = await supportConversationModel.findOne({ customerId: req.userId });

        if(!conversation){
            return res.status(404).json({
                success: false,
                message: "Start a support conversation first."
            });
        }

        // Save customer message
        const newMessage = await supportMessageModel.create({
            conversationId: conversation._id,
            senderType: "customer",
            senderId: req.userId,
            message,
            isRead: false
        });

        await supportConversationModel.findByIdAndUpdate(
            conversation._id,
            {
                $set: {
                    lastMessage: message,
                    lastMessageAt: newMessage.createdAt,
                    status: "open"
                },
                ...(conversation.mode === "human"
                    ? {
                        $inc: {
                            adminUnreadCount: 1
                        }
                    }
                    : {})
            }
        );

        // Broadcast customer message
        emitSupportEvent(
            conversation,
            "support:new-message",
            {
                conversationId: String(conversation._id),
                message: newMessage
            }
        );

        // Human mode - Admin handles the reply
        if(conversation.mode === "human"){
            return res.status(201).json({
                success: true,
                message: "Message sent to human support.",
                data: newMessage,
                mode: "human"
            });
        }

        // AI Mode
        let aiMessage = null;
        let usedFreeFallback = false;

        try {
            let botReply = "";

            // Look up verified order data only when the question requests the customer's actual order information.
            const orderLookup = await getSupportOrderContext(
                req.userId,
                message
            );

            if(orderLookup?.directReply){
                // No matching order found.
                // Do not ask Gemini to guess an order status.
                botReply = orderLookup.directReply;
            } else if (process.env.SUPPORT_AI_ENABLED === "false"){
                // Free FAQ mode: do not call Gemini.
                usedFreeFallback = true;

                botReply = orderLookup?.fallbackReply || generateRuleBasedReply(message);
            } else {
                try {
                    const recentMessages = await supportMessageModel.find({ conversationId: conversation._id, _id: { $ne: newMessage._id }, senderType: { $in: ["customer", "ai"] } }).sort({ createdAt: -1, _id: -1 }).limit(10).lean();

                    botReply = await generateGeminiSupportReply(
                        message,
                        recentMessages.reverse(),
                        orderLookup?.verifiedOrder || null
                    );

                    console.log("QuickTaste Gemini AI Reply Generated Successfully!");

                } catch (aiError) {
                    usedFreeFallback = true;

                    console.error("QuickTaste AI Fallback:", {
                        status: aiError.status,
                        code: aiError.code,
                        message: aiError.message
                    });

                    // For order questions, show verified data even when Gemini is temporarily unavailable.
                    botReply = orderLookup?.fallbackReply || generateRuleBasedReply(message);
                }
            }

            // Check mode again before saving the bot reply
            const currentConversation = await supportConversationModel.findById(conversation._id);

            if(currentConversation?.mode === "ai" && currentConversation.status === "open" && currentConversation.lastMessage === message && currentConversation.lastMessageAt?.getTime() === newMessage.createdAt.getTime()){
                aiMessage = await supportMessageModel.create({
                    conversationId: conversation._id,
                    senderType: "ai",
                    message: botReply,
                    isRead: false
                });

                await supportConversationModel.findByIdAndUpdate(
                    conversation._id,
                    {
                        $set: {
                            lastMessage: botReply,
                            lastMessageAt: aiMessage.createdAt
                        },
                        $inc: {
                            customerUnreadCount: 1
                        }
                    }
                );

                emitSupportEvent(
                    conversation,
                    "support:new-message",
                    {
                        conversationId: String(conversation._id),
                        message: aiMessage
                    }
                );
            }
        } catch (botError) {
            console.error("QuickTaste Bot Processing Error:", botError.message);

            return res.status(201).json({
                success: true,
                message: "Customer message saved, but the bot reply failed.",
                data: newMessage,
                aiMessage: null,
                aiUnavailable: true,
                mode: "ai"
            });
        }

        return res.status(201).json({
            success: true,
            message: usedFreeFallback ? "Free automated FAQ reply generated." : "AI reply generated successfully.",
            data: newMessage,
            aiMessage,
            aiUnavailable: false,
            usedFreeFallback,
            mode: "ai"
        });

    } catch (error) {
        console.error("Send Customer Support Message Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to send message."
        });
    }
};

// Customer : Request Human Support
const requestHumanSupport = async (req, res) => {
    try {
        const conversation = await supportConversationModel.findOne({ customerId: req.userId });

        if(!conversation){
            return res.status(404).json({
                success: false,
                message: "Support conversation not found."
            });
        }

        if(conversation.mode === "human" && conversation.status === "open"){
            return res.status(200).json({
                success: true,
                message: "Human support already requested.",
                conversation
            });
        }

        conversation.mode = "human";
        conversation.status = "open";

        const systemText = "Human support requested. Waiting for an admin.";

        const systemMessage = await supportMessageModel.create({
            conversationId: conversation._id,
            senderType: "system",
            message: systemText,
            isRead: true
        });

        conversation.lastMessage = systemText;
        conversation.lastMessageAt = systemMessage.createdAt;

        await conversation.save();

        emitSupportEvent(conversation, "support:human-requested", {
            conversationId: String(conversation._id),
            mode: "human",
            systemMessage
        });

        return res.status(200).json({
            success: true,
            message: "Human support requested successfully.",
            conversation,
            systemMessage
        });

    } catch (error) {
        console.error("Request Human Support Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to request human support."
        });
    }
};

// Customer : Switch Back to AI Support
const switchToAISupport = async (req, res) => {
    try {
        const conversation = await supportConversationModel.findOne({customerId: req.userId});

        if(!conversation){
            return res.status(404).json({
                success: false,
                message: "Support conversation not found."
            });
        }

        if(conversation.mode === "ai" && conversation.status === "open"){
            return res.status(200).json({
                success: true,
                message: "AI support is already active.",
                conversation,
                systemMessage: null
            });
        }

        // Only switch the authenticated customer's conversation.
        // Keep the same conversation and chat history.
        const updatedConversation = await supportConversationModel.findOneAndUpdate(
            {
                _id: conversation._id,
                customerId: req.userId
            },
            {
                $set: {
                    mode: "ai",
                    status: "open",
                    assignedAdmin: null
                }
            },
            {
                returnDocument: "after",
                runValidators: true
            }
        );

        const systemText = "You have switched back to QuickTaste AI Support.";

        const systemMessage = await supportMessageModel.create({
            conversationId: conversation._id,
            senderType: "system",
            message: systemText,
            isRead: true
        });

        updatedConversation.lastMessage = systemText;
        updatedConversation.lastMessageAt = systemMessage.createdAt;

        await updatedConversation.save();

        // Notify both customer and admin clients.
        emitSupportEvent(
            updatedConversation,
            "support:mode-changed",
            {
                conversationId: String(updatedConversation._id),
                mode: "ai",
                conversation: updatedConversation,
                systemMessage
            }
        );

        return res.status(200).json({
            success: true,
            message: "Switched to QuickTaste AI Support.",
            conversation: updatedConversation,
            systemMessage
        });
    } catch (error) {
        console.error("Switch To AI Support Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to switch to AI support."
        });
    }
};

// Admin : Get All Support Conversations
const getAdminSupportConversations = async (req, res) => {
    try {
        const conversations = await supportConversationModel.find({}).populate("customerId", "name email").sort({ lastMessageAt: -1 }).limit(MESSAGE_LIMIT).lean();

        return res.status(200).json({
            success: true,
            conversations
        });

    } catch (error) {
        console.error("Get Admin Support Conversations Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to load support conversations."
        });
    }
};

// Admin : Get Conversation Messages
const getAdminSupportMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;

        if(!mongoose.isValidObjectId(conversationId)){
            return res.status(400).json({
                success: false,
                message: "Invalid conversation ID."
            });
        }

        const conversation = await supportConversationModel.findById(conversationId).populate("customerId", "name email");

        if(!conversation){
            return res.status(404).json({
                success: false,
                message: "Conversation not found."
            });
        }

        const messages = await supportMessageModel.find({ conversationId }).sort({ createdAt: -1, _id: -1 }).limit(MESSAGE_LIMIT).lean();

        return res.status(200).json({
            success: true,
            conversation,
            messages: messages.reverse()
        });

    } catch (error) {
        console.error("Get Admin Support Messages Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to load conversation messages."
        });
    }
};

// Admin : Send Reply
const sendAdminSupportReply = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const message = validateMessage(req.body?.message);

        if(!mongoose.isValidObjectId(conversationId)){
            return res.status(400).json({
                success: false,
                message: "Invalid conversation ID."
            });
        }

        if(!message){
            return res.status(400).json({
                success: false,
                message: "Message must contain 1 to 2000 characters."
            });
        }

        if(!mongoose.isValidObjectId(req.adminId)){
            return res.status(401).json({
                success: false,
                message: "Invalid admin authentication."
            });
        }

        const conversation = await supportConversationModel.findById(conversationId);

        if(!conversation){
            return res.status(404).json({
                success: false,
                message: "Conversation not found."
            });
        }

        if(conversation.mode !== "human"){
            return res.status(409).json({
                success: false,
                message: "The customer has switched to AI Support. " + "Human replies are not available in AI mode."
            });
        }

        const updatedConversation = await supportConversationModel.findOneAndUpdate(
            {
                _id: conversation._id,
                mode: "human"
            },
            {
                $set: {
                    status: "open",
                    assignedAdmin: req.adminId
                }
            },
            {
                returnDocument: "after"
            }
        );

        if(!updatedConversation){
            return res.status(409).json({
                success: false,
                message: "Customer is no longer in Human Support mode."
            });
        }

        // Save admin message
        const newMessage = await supportMessageModel.create({
            conversationId: conversation._id,
            senderType: "admin",
            senderId: req.adminId,
            message,
            isRead: false
        });

        // Update conversation preview and unread count
        await supportConversationModel.findByIdAndUpdate(
            conversation._id,
            {
                $set: {
                    lastMessage: message,
                    lastMessageAt: newMessage.createdAt
                },
                $inc: {
                    customerUnreadCount: 1
                }
            }
        );

        emitSupportEvent(conversation, "support:new-message", {
            conversationId: String(conversation._id),
            message: newMessage
        });

        return res.status(201).json({
            success: true,
            message: "Admin reply sent successfully.",
            data: newMessage
        });

    } catch (error) {
        console.error("Send Admin Support Reply Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to send admin reply."
        });
    }
};

export { startSupportConversation, getCustomerSupportMessages, sendCustomerSupportMessage, requestHumanSupport, switchToAISupport, getAdminSupportConversations, getAdminSupportMessages, sendAdminSupportReply }