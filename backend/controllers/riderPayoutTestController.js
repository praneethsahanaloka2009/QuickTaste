import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import riderPayoutModel from "../models/riderPayoutModel.js";
import riderPayoutTransactionModel from "../models/riderPayoutTransactionModel.js";

// Test transfers must never run in production.
const isTestModeEnabled = () => {
    return (
        process.env.NODE_ENV === "development" && process.env.RIDER_PAYOUT_TEST_MODE === "true"
    );
};

const toCents = (amount) => Math.round(Number(amount) * 100);

const isValidAmount = (amount) => typeof amount === "number" && Number.isFinite(amount) && amount > 0 && Math.abs(amount * 100 - Math.round(amount * 100)) < 0.000001;

// Initiate mock bank transfer
const initiateTestRiderPayout = async (req, res) => {
    if(!isTestModeEnabled()){
        return res.status(403).json({
            success: false,
            message: "Test payouts are disabled."
        });
    }

    const { id } = req.params;

    if(!mongoose.isValidObjectId(id)){
        return res.status(400).json({
            success: false,
            message: "Invalid payout ID."
        });
    }

    if(!mongoose.isValidObjectId(req.adminId)){
        return res.status(401).json({
            success: false,
            message: "Admin authentication is required."
        });
    }

    const transferId = randomUUID();
    let session;

    try {
        session = await mongoose.startSession();

        let result = null;

        await session.withTransaction(async () => {
            
            const payout = await riderPayoutModel.findById(id).session(session);

            if(!payout){
                const error = new Error("Rider payout not found.");
                error.statusCode = 404;
                throw error;
            }

            const isFirstAttempt = payout.status === "Pending" && payout.payoutMode === "Manual" && payout.environment === "manual";

            const isRetry = payout.status === "Failed" && payout.payoutMode === "Automatic Test" && payout.environment === "test";

            if(!isFirstAttempt && !isRetry){
                const error = new Error("Only pending manual payouts or failed test payouts can be processed.");
                error.statusCode = 409;
                throw error;
            }

            if(!isValidAmount(payout.totalAmount)){
                const error = new Error("Invalid payout amount.");
                error.statusCode = 400;
                throw error;
            }

            const existingTransaction = await riderPayoutTransactionModel.findOne({
                payoutId: payout._id,
                status: {
                    $in: [
                        "Pending",
                        "Processing",
                        "Succeeded"
                    ]
                }
            })
            .session(session);

            if(existingTransaction){
                const error = new Error("An active or successful test transfer already exists.");
                error.statusCode = 409;
                throw error;
            }

            const reservedPayout = await riderPayoutModel.findOneAndUpdate(
                {
                    _id: payout._id,
                    status: payout.status,
                    payoutMode: payout.payoutMode,
                    environment: payout.environment
                },
                {
                    $set: {
                        status: "Processing",
                        payoutMode: "Automatic Test",
                        environment: "test",
                        paymentMethod: "Bank Transfer",
                        paidBy: null,
                        paidAt: null,
                        paymentReference: ""
                    }
                },
                {
                    session,
                    returnDocument: "after",
                    runValidators: true
                }
            )

            if(!reservedPayout){
                const error = new Error("Payout is already being processed or its status has changed.");
                error.statusCode = 409;
                throw error;
            }

            const transactions = await riderPayoutTransactionModel.create(
                [
                    {
                        payoutId: reservedPayout._id,
                        riderId: reservedPayout.riderId,
                        branchId: reservedPayout.branchId,
                        amount: toCents(reservedPayout.totalAmount) / 100,
                        currency: "USD",
                        environment: "test",
                        provider: "mock",
                        status: "Processing",
                        idempotencyKey: `test-${reservedPayout._id}-${transferId}`,
                        providerReference: `MOCK-${transferId}`,
                        initiatedBy: req.adminId
                    }
                ],
                {
                    session
                }
            );

            result = {
                payout: reservedPayout,
                transaction: transactions[0]
            };

        });

        return res.status(202).json({
            success: true,
            message: "Mock bank transfer initiated.",
            environment: "test",
            realMoneyTransferred: false,
            ...result
        });

    } catch (error) {
        console.error("Initiate Test Payout Error:", error);

        return res.status(error.statusCode || (error.code === 11000 ? 409 : 500)).json({
            success: false,
            message: error.statusCode ? error.message : "Could not initiate test payout."
        });

    } finally {
        if(session){
            await session.endSession();
        }
    }
};

// Complete mock bank transfer
const completeTestRiderPayout = async (req, res) => {
    if(!isTestModeEnabled()){
        return res.status(403).json({
            success: false,
            message: "Test payouts are disabled."
        });
    }
    
    const { transactionId } = req.params;
    const { outcome } = req.body;

    if(!mongoose.isValidObjectId(transactionId)){
        return res.status(400).json({
            success: false,
            message: "Invalid transaction ID."
        });
    }

    if(!["success", "failure"].includes(outcome)){
        return res.status(400).json({
            success: false,
            message: "Outcome must be success or failure."
        });
    }

    if(!mongoose.isValidObjectId(req.adminId)){
        return res.status(401).json({
            success: false,
            message: "Admin authentication is required."
        });
    }

    let session;

    try {
        session = await mongoose.startSession();
        
        let result = null;

        await session.withTransaction(async () => {
            const transaction = await riderPayoutTransactionModel.findById(transactionId).session(session);

            if(!transaction){
                const error = new Error("Test transaction not found.");
                error.statusCode = 404;
                throw error;
            }

            if(transaction.environment !== "test" || transaction.provider !== "mock"){
                const error = new Error("Only mock transactions are supported.");
                error.statusCode = 403;
                throw error;
            }

            if(transaction.status !== "Processing"){
                const error = new Error("Transaction is not processing.");
                error.statusCode = 409;
                throw error;
            }

            const payout = await riderPayoutModel.findOne({
                _id: transaction.payoutId,
                status: "Processing",
                payoutMode: "Automatic Test",
                environment: "test"
            }).session(session);

            if(!payout){
                const error = new Error("Payout is not processing.");
                error.statusCode = 409;
                throw error;
            }

            const succeeded = outcome === "success";
            const now = new Date();

            const updatedTransaction = await riderPayoutTransactionModel.findOneAndUpdate(
                {
                    _id: transaction._id,
                    status: "Processing"
                },
                {
                    $set: {
                        status: succeeded ? "Succeeded" : "Failed",
                        completedAt: now,
                        failureReason: succeeded ? "" : "Simulated transfer failure."
                    }
                },
                {
                    session,
                    returnDocument: "after",
                    runValidators: true
                }
            );

            if(!updatedTransaction){
                const error = new Error("Transaction already completed.");
                error.statusCode = 409;
                throw error;
            }

            const updatedPayout = await riderPayoutModel.findOneAndUpdate(
                {
                    _id: payout._id,
                    status: "Processing",
                    payoutMode: "Automatic Test",
                    environment: "test"
                },
                {
                    $set: {
                        status: succeeded ? "Paid" : "Failed",
                        paidBy: succeeded ? req.adminId : null,
                        paidAt: succeeded ? now : null,
                        paymentReference: succeeded ? updatedTransaction.providerReference : ""
                    }
                },
                {
                    session,
                    returnDocument: "after",
                    runValidators: true
                }
            );

            if(!updatedPayout){
                const error = new Error("Payout update failed.");
                error.statusCode = 409;
                throw error;
            }

            result = {
                transaction: updatedTransaction,
                payout: updatedPayout
            };
        });

        return res.status(200).json({
            success: true,
            message: outcome === "success" ? "Mock transfer succeeded." : "Mock transfer failed.",
            environment: "test",
            realMoneyTransferred: false,
            ...result
        });

    } catch (error) {
        console.error("Complete Test Payout Error:", error);

        return res.status(error.statusCode || (error.code === 11000 ? 409 : 500)).json({
            success: false,
            message: error.statusCode ? error.message : "Could not complete test payout."
        });

    } finally {
        if(session){
            await session.endSession();
        }
    }
};

// Get mock payout transactions - Admin Only
const getTestRiderPayoutTransactions = async (req, res) => {
    if(!isTestModeEnabled()){
        return res.status(403).json({
            success: false,
            message: "Test payouts are disabled."
        });
    }

    try {
        const transactions = await riderPayoutTransactionModel.find({ environment: "test", provider: "mock" }).select("_id payoutId amount currency status environment provider providerReference failureReason initiatedBy initiatedAt completedAt createdAt").sort({ createdAt: -1 }).lean();

        return res.status(200).json({
            success: true,
            environment: "test",
            realMoneyTransferred: false,
            transactions
        });

    } catch (error) {
        console.error("Get Test Payout Transactions Error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not load test payout transactions."
        });
    }
}

export { initiateTestRiderPayout, completeTestRiderPayout , getTestRiderPayoutTransactions};