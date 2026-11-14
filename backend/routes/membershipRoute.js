import express from "express";
import { initializeMembershipPlans, getMembershipPlans } from "../controllers/membershipController.js";
import adminAuth from "../middleware/adminAuth.js";

const membershipRouter = express.Router();

// Public: Get available membership plans
membershipRouter.get("/plans", getMembershipPlans);

// Admin: Initialize default membership plans
membershipRouter.post("/initialize", adminAuth, initializeMembershipPlans);

export default membershipRouter;