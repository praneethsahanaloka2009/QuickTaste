import express from "express";
import { initializeMembershipPlans, getMembershipPlans, getMySubscription, getMyMembershipHistory, getMyMembershipPayments } from "../controllers/subscriptionController.js";
// import { createMembershipCheckout } from "../controllers/subscriptionPaymentController.js";
import { cancelMembershipSubscription } from "../controllers/subscriptionCancellationController.js";
import { createRecurringMembershipCheckout } from "../controllers/subscriptionRecurringCheckoutController.js";
import { createMembershipBillingPortal } from "../controllers/subscriptionBillingPortalController.js";
import adminAuth from "../middleware/adminAuth.js";
import authMiddleware from "../middleware/auth.js";

const subscriptionRouter = express.Router();

// Public - Get membership plans
subscriptionRouter.get("/plans", getMembershipPlans);

// Admin - Initialize membership plans
subscriptionRouter.post("/admin/initialize", adminAuth, initializeMembershipPlans);

// Customer - Get own subscription
subscriptionRouter.get("/my-subscription", authMiddleware, getMySubscription);

// Customer membership history
subscriptionRouter.get("/my-history", authMiddleware, getMyMembershipHistory);

// Customer - Create Stripe one-time membership checkout
// subscriptionRouter.post("/create-checkout-session", authMiddleware, createMembershipCheckout);

// Customer - Cancel automatic membership renewal
subscriptionRouter.put("/cancel", authMiddleware, cancelMembershipSubscription);

// Customer - Create Stripe monthly recurring membership checkout
subscriptionRouter.post("/create-recurring-checkout", authMiddleware, createRecurringMembershipCheckout);

// Customer: Get membership payment history
subscriptionRouter.get("/my-payments", authMiddleware, getMyMembershipPayments);

// Customer - Open Stripe Billing Portal
subscriptionRouter.post("/create-billing-portal", authMiddleware, createMembershipBillingPortal);

export default subscriptionRouter;