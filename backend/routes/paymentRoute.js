import express from "express";

import {createStripeSession, verifyStripePayment} from "../controllers/paymentController.js";

import authMiddleware from "../middleware/auth.js";

const paymentRouter = express.Router();

paymentRouter.post("/stripe/create-session", authMiddleware,createStripeSession);
paymentRouter.post("/stripe/verify", authMiddleware, verifyStripePayment);

export default paymentRouter;