import express from "express"
import { addMessage, getMessages, removeMessage, sendReply } from "../controllers/messageController.js"
import adminAuth from "../middleware/adminAuth.js";

const messageRouter = express.Router();

messageRouter.post("/add", addMessage);
messageRouter.get("/list", adminAuth, getMessages);
messageRouter.post("/remove", adminAuth, removeMessage);
messageRouter.post("/reply", adminAuth, sendReply);

export default messageRouter;