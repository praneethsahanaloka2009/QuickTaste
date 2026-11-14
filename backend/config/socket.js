import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import supportConversationModel from "../models/supportConversationModel.js";
import riderModel from "../models/riderModel.js";
import { registerTrackingSocket } from "../sockets/trackingSocket.js";

let io = null;

export const initializeSocket = (httpServer) => {
    const allowedOrigins = ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", process.env.FRONTEND_URL, process.env.ADMIN_URL, process.env.RIDER_URL].filter(Boolean);

    io = new Server(httpServer, {
        cors: {
            origin: allowedOrigins,
            methods: ["GET", "POST"]
        },
        allowRequest: (req, callback) => {
            const origin = req.headers.origin;

            if(!origin || allowedOrigins.includes(origin)){
                return callback(null, true);
            }

            return callback("Origin not allowed", false);
        }
    });

    // Authenticate Customer, Admin and Rider socket connections
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            const role = socket.handshake.auth?.role;

            if(typeof token !== "string" || !token || !["customer", "admin", "rider"].includes(role)){
                return next(new Error("Unauthorized socket connection."));
            }

            const secret = role === "admin" ? process.env.ADMIN_JWT_SECRET : role === "rider" ? process.env.RIDER_JWT_SECRET : process.env.JWT_SECRET;

            if(!secret){
                return next(new Error("Socket authentication is unavailable."));
            }

            const decoded = jwt.verify(token, secret);

            if(!decoded || !mongoose.isValidObjectId(decoded.id)){
                return next(new Error("Invalid socket identity."));
            }

            // Rider authentication must use the separate Rider database.
            if(role === "rider"){
                if(decoded.role !== "rider"){
                    return next(new Error("Invalid rider token."));
                }

                const rider = await riderModel.findById(decoded.id).select("_id isActive");

                if(!rider || !rider.isActive){
                    return next(new Error("Rider account is inactive."));
                }
            }

            socket.data.userId = String(decoded.id);
            socket.data.role = role;

            next();

        } catch (error) {
            next(new Error("Invalid or expired socket token."));
        }
    });

    io.on("connection", (socket) => {
        const { userId, role } = socket.data;
        registerTrackingSocket(io, socket);

        if(role === "admin"){
            socket.join("support:admins");
        }

        if(role === "customer"){
            socket.join(`support:customer:${userId}`);
        }

        // Join a conversation only after authorization
        socket.on("support:join", async (conversationId, callback) => {
            try {
                if(!mongoose.isValidObjectId(conversationId)){
                    callback?.({
                        success: false,
                        message: "Invalid conversation ID."
                    });
                    return;
                }

                const conversation = await supportConversationModel.findById(conversationId);

                if(!conversation){
                    callback?.({
                        success: false,
                        message: "Conversation not found."
                    });
                    return;
                }

                if(role !== "admin" && (role !== "customer" || String(conversation.customerId) !== String(userId))){
                    callback?.({
                        success: false,
                        message: "Access denied."
                    });
                    return;
                }

                socket.join(`support:conversation:${conversationId}`);

                callback?.({
                    success: true
                });

            } catch (error) {
                callback?.({
                    success: false,
                    message: "Unable to join conversation."
                });
            }
        });

        // Real-time typing indicators (Human Support only)
        socket.on("support:typing", async (payload) => {
            try {
                const conversationId = payload?.conversationId;
                const isTyping = payload?.isTyping;

                // Validate incoming data
                if(!mongoose.isValidObjectId(conversationId) || typeof isTyping !== "boolean"){
                    return;
                }

                const room = `support:conversation:${conversationId}`;

                // Sender must have joined this conversation
                if(!socket.rooms.has(room)){
                    return;
                }

                // Check actual conversation and mode
                const conversation = await supportConversationModel.findById(conversationId).select("customerId mode");

                if(!conversation || conversation.mode !== "human"){
                    return;
                }

                // Customer can only type in their own conversation
                if(role !== "admin" && (role !== "customer" || String(conversation.customerId) !== String(userId))){
                    return;
                }

                // Check sender is still in the room
                if(!socket.rooms.has(room)){
                    return;
                }

                // Send to other participants only
                socket.to(room).emit("support:typing", {
                    conversationId: String(conversationId),
                    senderType: role,
                    isTyping
                });
            } catch (error) {
                console.error("Support typing event error:", error.message);
            }
        });

        socket.on("support:leave", (conversationId) => {
            if(typeof conversationId === "string" && mongoose.isValidObjectId(conversationId)){
                socket.leave(`support:conversation:${conversationId}`);
            }
        });
    });

    return io;
};

// Broadcast saved chat events
export const emitSupportEvent = (conversation, event, payload) => {
    if(!io || !conversation){
        return;
    }

    const conversationId = String(conversation._id);

    io.to(`support:conversation:${conversationId}`).to(`support:customer:${String(conversation.customerId)}`).to("support:admins").emit(event, payload);
};