import express from "express";
import rateLimit from "express-rate-limit";
import authMiddleware from "../middleware/auth.js";
import adminAuth from "../middleware/adminAuth.js";
import { startSupportConversation, getCustomerSupportMessages, sendCustomerSupportMessage, requestHumanSupport, switchToAISupport, getAdminSupportConversations, getAdminSupportMessages, sendAdminSupportReply } from "../controllers/supportChatController.js";

const supportChatRouter = express.Router();

// Limit chat requests to prevent abuse
const messageLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many chat requests. Please try again later."
    }
});

// Customer Routes
supportChatRouter.post("/customer/start", authMiddleware, messageLimiter, startSupportConversation);
supportChatRouter.get("/customer/messages", authMiddleware, getCustomerSupportMessages);
supportChatRouter.post("/customer/send", authMiddleware, messageLimiter, sendCustomerSupportMessage);
supportChatRouter.post("/customer/request-human", authMiddleware, messageLimiter, requestHumanSupport);
supportChatRouter.post("/customer/switch-to-ai", authMiddleware, messageLimiter, switchToAISupport);

// Admin Routes
supportChatRouter.get("/admin/conversations", adminAuth, getAdminSupportConversations);
supportChatRouter.get("/admin/conversations/:conversationId/messages", adminAuth, getAdminSupportMessages);
supportChatRouter.post("/admin/conversations/:conversationId/reply", adminAuth, messageLimiter, sendAdminSupportReply);

export default supportChatRouter;