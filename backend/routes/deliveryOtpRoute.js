import express from "express";
import authMiddleware from "../middleware/auth.js";
import riderAuth from "../middleware/riderAuth.js";
import { sendDeliveryOtp, verifyDeliveryOtp } from "../controllers/deliveryOtpController.js";

const deliveryOtpRouter = express.Router();

// Customer requests delivery OTP
deliveryOtpRouter.post("/:id/send-otp", authMiddleware, sendDeliveryOtp);

// Assigned rider verifies delivery OTP
deliveryOtpRouter.post("/:id/verify-otp", riderAuth, verifyDeliveryOtp);

export default deliveryOtpRouter;