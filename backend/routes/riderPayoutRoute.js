import express from "express";
import { createRiderPayout, getRiderPayouts, confirmRiderPayout, getMyRiderPayouts, getMyRiderEarnings } from "../controllers/riderPayoutController.js";
import { initiateTestRiderPayout, completeTestRiderPayout, getTestRiderPayoutTransactions } from "../controllers/riderPayoutTestController.js";
import adminAuth from "../middleware/adminAuth.js";
import riderAuth from "../middleware/riderAuth.js";

const riderPayoutRouter = express.Router();

// Rider Only
// Get authenticated rider's payout history
riderPayoutRouter.get("/my-payouts", riderAuth, getMyRiderPayouts);

// Rider Earnings — Rider Only
riderPayoutRouter.get("/my-earnings", riderAuth, getMyRiderEarnings);

// Admin Only
riderPayoutRouter.use(adminAuth);

// Create Rider Payout
riderPayoutRouter.post("/create", createRiderPayout);

// Get All Rider Payouts
riderPayoutRouter.get("/list", getRiderPayouts);

// Confirm Manual Rider Payment
riderPayoutRouter.put("/:id/confirm", confirmRiderPayout);

// Automatic Rider Payout - Test Mode Only
// Register test routes only in development
// when the test-mode flag is explicitly enabled.
if(process.env.NODE_ENV === "development" && process.env.RIDER_PAYOUT_TEST_MODE === "true"){

    // Get simulated bank transactions
    riderPayoutRouter.get("/test-transactions", getTestRiderPayoutTransactions);

    // Initiate simulated bank transfer
    riderPayoutRouter.post("/:id/test-transfer", initiateTestRiderPayout);

    // Complete simulated transfer
    riderPayoutRouter.put("/test-transactions/:transactionId/complete", completeTestRiderPayout);
}

export default riderPayoutRouter;