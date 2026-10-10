import express from "express";

import {createOrder, getUserOrders, getOrderById, getAllOrders, cancelOrder, updateOrderStatus} from "../controllers/orderController.js";

import authMiddleware from "../middleware/auth.js";
import adminAuth from "../middleware/adminAuth.js";

const orderRouter = express.Router();

// Create Order
orderRouter.post("/create", authMiddleware, createOrder);

// Get Logged-in User Orders
orderRouter.get("/my-orders", authMiddleware, getUserOrders);

// Cancel Order - Customer
orderRouter.put("/cancel/:id", authMiddleware, cancelOrder);

// Get All Orders For Admin
orderRouter.get("/admin/orders", adminAuth, getAllOrders);

// Update Order Status - Admin
orderRouter.put("/admin/update-status/:id", adminAuth, updateOrderStatus);

// Get Single Order
orderRouter.get("/:id", authMiddleware, getOrderById);

export default orderRouter;