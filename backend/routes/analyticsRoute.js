import express from "express";
import { getAnalyticsOverview, getRevenueAnalytics, getOrderAnalytics, getFoodAnalytics } from "../controllers/analyticsController.js";
import adminAuth from "../middleware/adminAuth.js";

// Protect every analytics endpoint
const analyticsRouter = express.Router();

// Protect every analytics endpoint
analyticsRouter.use(adminAuth);

// Analytics Overview
analyticsRouter.get("/overview", getAnalyticsOverview);

// Revenue Analytics
analyticsRouter.get("/revenue", getRevenueAnalytics);

// Order Analytics
analyticsRouter.get("/orders", getOrderAnalytics);

// Food Analytics
analyticsRouter.get("/foods", getFoodAnalytics);

export default analyticsRouter;