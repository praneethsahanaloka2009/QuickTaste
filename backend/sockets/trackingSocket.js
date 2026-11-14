import mongoose from "mongoose";
import orderModel from "../models/orderModel.js";

const trackingRoom = (orderId) => `tracking:order:${orderId}`;

const isValidLocation = (location) => {
    if(!location || typeof location !== "object"){
        return false;
    }

    const { latitude, longitude } = location;

    return (
        typeof latitude === "number" && typeof longitude === "number" && Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
    );
};export const registerTrackingSocket = (io, socket) => {
    const { userId, role } = socket.data;

    // Store last accepted GPS update time per order.
    const lastLocationUpdate = new Map();

    // Customer or assigned rider joins tracking room.
    socket.on("tracking:join", async (orderId, callback) => {
        try {
            if(typeof orderId !== "string" || !mongoose.isValidObjectId(orderId)){
                callback?.({
                    success: false,
                    message: "Invalid order ID."
                });
                return;
            }

            const order = await orderModel.findById(orderId).select("userId assignedRider orderStatus riderDeliveryConfirmedAt");

            if(!order){
                callback?.({
                    success: false,
                    message: "Order not found."
                });
                return;
            }

            const isCustomer = role === "customer" && String(order.userId) === String(userId);

            const isAssignedRider = role === "rider" && String(order.assignedRider) === String(userId);

            if(!isCustomer && !isAssignedRider){
                callback?.({
                    success: false,
                    message: "Tracking access denied."
                });
                return;
            }

            if(order.orderStatus !== "Out for Delivery" || order.riderDeliveryConfirmedAt){
                callback?.({
                    success: false,
                    message: "Live tracking is not active for this order."
                });
                return;
            }

            socket.join(trackingRoom(orderId));

            callback?.({
                success: true,
                message: "Joined live tracking."
            });

        } catch (error) {
            console.error("Tracking join error:", error.message);

            callback?.({
                success: false,
                message: "Unable to join tracking."
            });
        }
    });

    // Assigned rider sends GPS location.
    socket.on("tracking:location", async (payload, callback) => {
        try {
            if(role !== "rider"){
                callback?.({
                    success: false,
                    message: "Only riders can update locations."
                });
                return;
            }

            const { orderId, latitude, longitude } = payload || {};

            if(typeof orderId !== "string" || !mongoose.isValidObjectId(orderId) || !isValidLocation({ latitude, longitude })){
                callback?.({
                    success: false,
                    message: "Invalid tracking data."
                });
                return;
            }

            const now = Date.now();
            const previousUpdate = lastLocationUpdate.get(orderId) || 0;

            // Allow one accepted update every 3 seconds.
            if(now - previousUpdate < 3000){
                callback?.({
                    success: false,
                    message: "Please wait before sending another location update."
                });
                return;
            }

            const order = await orderModel.findById(orderId).select("assignedRider orderStatus riderDeliveryConfirmedAt");

            if(!order || String(order.assignedRider) !== String(userId) || order.orderStatus !== "Out for Delivery" || order.riderDeliveryConfirmedAt){
                callback?.({
                    success: false,
                    message: "Tracking update not authorized."
                });
                return;
            }

            const room = trackingRoom(orderId);

            if(!socket.rooms.has(room)){
                callback?.({
                    success: false,
                    message: "Join tracking before sending location."
                });
                return;
            }

            const update = {
                orderId,
                latitude,
                longitude,
                updatedAt: new Date().toISOString()
            };

            lastLocationUpdate.set(orderId, Date.now());

            socket.to(room).emit("tracking:location-updated", update);

            callback?.({
                success: true
            });

        } catch (error) {
            console.error("Tracking location error:", error.message);

            callback?.({
                success: false,
                message: "Unable to update rider location."
            });
        }
    });

    // Leave tracking room.
    socket.on("tracking:leave", (orderId) => {
        if(typeof orderId === "string" && mongoose.isValidObjectId(orderId)){
            socket.leave(trackingRoom(orderId));
            lastLocationUpdate.delete(orderId);
        }
    });
};