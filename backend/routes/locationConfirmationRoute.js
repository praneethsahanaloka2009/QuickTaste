import express from "express";
import authMiddleware from "../middleware/auth.js";
import { sendLocationOtp, verifyLocationOtp, confirmCustomerLocation } from "../controllers/locationConfirmationController.js";

const locationConfirmationRouter = express.Router();

// All endpoints require customer authentication.
locationConfirmationRouter.use(authMiddleware);

// Send location confirmation OTP.
locationConfirmationRouter.post("/:id/send-otp", sendLocationOtp);

// Verify location confirmation OTP.
locationConfirmationRouter.post("/:id/verify-otp", verifyLocationOtp);

// Submit customer's current GPS location.
locationConfirmationRouter.put("/:id/confirm", confirmCustomerLocation);

export default locationConfirmationRouter;