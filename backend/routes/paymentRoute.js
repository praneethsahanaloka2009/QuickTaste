import express from "express";
import { createStripeSession, verifyStripePayment, createCodOrder, getCheckoutSummary } from "../controllers/paymentController.js";
import { refundStripePayment, recoverStripeRefundAdmin } from "../controllers/refundController.js";
import authMiddleware from "../middleware/auth.js";
import adminAuth from "../middleware/adminAuth.js";

const paymentRouter = express.Router();

// Customer: Stripe Checkout
paymentRouter.post("/stripe/create-session", authMiddleware, createStripeSession);

// Customer: Verify Stripe Payment
paymentRouter.post("/stripe/verify", authMiddleware, verifyStripePayment);

// Customer: Cash on Delivery
paymentRouter.post("/cod/create-order", authMiddleware, createCodOrder);

// Admin: Issue a full Stripe refund
paymentRouter.post("/stripe/refund/:orderId", adminAuth, refundStripePayment);

// Admin: Recover/check an existing refund
paymentRouter.post("/stripe/refund/:orderId/recover", adminAuth, recoverStripeRefundAdmin);

// Customer: Preview membership and promo-adjusted checkout pricing
paymentRouter.post("/checkout/summary", authMiddleware, getCheckoutSummary);

export default paymentRouter;