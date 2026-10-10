import express from "express"
import { addMessage, getMessages, removeMessage, sendReply } from "../controllers/messageController.js"

const messageRouter = express.Router();

messageRouter.post("/add", addMessage);
messageRouter.get("/list", getMessages);
messageRouter.post("/remove", removeMessage);
messageRouter.post("/reply", sendReply);

export default messageRouter;