import mongoose from "mongoose";
import codSettlementModel from "../models/codSettlementModel.js";
import orderModel from "../models/orderModel.js";

// Convert a monetary amount to cents for accurate comparisons
const toCents = (value) => {
    return Math.round(Number(value) * 100);
};

// Create a daily COD settlement batch - Admin
const createCodSettlement = async (req, res) => {
    try {
        const { branchId, riderId, orderIds, settlementDate } = req.body;

        if(!mongoose.isValidObjectId(branchId) || !mongoose.isValidObjectId(riderId)){
            return res.status(400).json({
                success: false,
                message: "Valid branch and rider IDs are required."
            });
        }

        if(!Array.isArray(orderIds) || orderIds.length === 0){
            return res.status(400).json({
                success: false,
                message: "Select at least one COD order."
            });
        }

        const uniqueOrderIds = [...new Set(orderIds.map(String))];

        if(uniqueOrderIds.length !== orderIds.length || !uniqueOrderIds.every((id) => mongoose.isValidObjectId(id))){
            return res.status(400).json({
                success: false,
                message: "Order IDs must be valid and unique."
            });
        }

        if(!settlementDate){
            return res.status(400).json({
                success: false,
                message: "Settlement date is required."
            });
        }

        // Accept a Sri Lankan business date in YYYY-MM-DD format
        if(typeof settlementDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(settlementDate)){
            return res.status(400).json({
                success: false,
                message: "Settlement date must be in YYYY-MM-DD format."
            });
        }

        const date = new Date(`${settlementDate}T00:00:00+05:30`);

        if(Number.isNaN(date.getTime()) || new Intl.DateTimeFormat("en-CA", {timeZone: "Asia/Colombo", year: "numeric", month: "2-digit", day: "2-digit"}).format(date) !== settlementDate){
            return res.status(400).json({
                success: false,
                message: "Invalid settlement date."
            });
        }

        // Only completed COD deliveries are eligible
        const orders = await orderModel.find({
            _id: { $in: uniqueOrderIds },
            branchId,
            assignedRider: riderId,
            paymentMethod: "Cash on Delivery",
            paymentStatus: "Paid",
            orderStatus: "Delivered",
            riderCashCollected: true
        });

        if(orders.length !== uniqueOrderIds.length){
            return res.status(400).json({
                success: false,
                message: "Some orders are not eligible. Check branch, rider, delivery and COD payment status."
            });
        }

        // Ensure all orders belong to the selected Sri Lankan business date
        const dateFormatter = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Colombo",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        });

        const businessDate = dateFormatter.format(date);

        const invalidDateOrder = orders.some((order) => {
            if(!order.deliveredAt) return true;
            return dateFormatter.format(order.deliveredAt) !== businessDate;
        });

        if(invalidDateOrder){
            return res.status(400).json({
                success: false,
                message: "All orders must have been delivered on the selected settlement date."
            });
        }

        // Prevent orders already assigned to another settlement
        const existingSettlement = await codSettlementModel.findOne({
            orders: { $in: uniqueOrderIds }
        });

        if(existingSettlement){
            return res.status(409).json({
                success: false,
                message: "One or more orders already belong to a COD settlement."
            });
        }

        // Calculate expected cash using the amount actually collected
        const expectedCents = orders.reduce((total, order) => {
            return total + toCents(order.riderCashCollectedAmount);
        }, 0);

        const invalidCashAmount = orders.some((order) => {
            const collected = Number(order.riderCashCollectedAmount);
            const expected = Number(order.amount) + Number(order.deliveryFee);

            return (!Number.isFinite(collected) || !Number.isFinite(expected) || collected < 0 || toCents(collected) !== toCents(expected));
        });

        if(invalidCashAmount || expectedCents <= 0){
            return res.status(400).json({
                success: false,
                message: "One or more orders have invalid COD collection amounts."
            });
        }

        const settlement = await codSettlementModel.create({
            branchId,
            riderId,
            settlementDate: date,
            orders: uniqueOrderIds,
            expectedAmount: expectedCents / 100,
            receivedAmount: 0,
            status: "Pending"
        });

        return res.status(201).json({
            success: true,
            message: "COD settlement batch created successfully.",
            settlement
        });

    } catch (error) {
        console.error("Create COD Settlement Error:", error);

        if(error.code === 11000){
            return res.status(409).json({
                success: false,
                message: "One or more orders already belong to a settlement."
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to create COD settlement."
        });
    }
};

// Get COD settlements - Admin
const getCodSettlements = async (req, res) => {
    try {
        const { status, branchId, riderId } = req.query;

        const filter = {};

        if(status){
            if(!["Pending", "Settled"].includes(status)){
                return res.status(400).json({
                    success: false,
                    message: "Invalid settlement status."
                });
            }

            filter.status = status;
        }

        if(branchId){
            if(!mongoose.isValidObjectId(branchId)){
                return res.status(400).json({
                    success: false,
                    message: "Invalid branch ID."
                });
            }

            filter.branchId = branchId;
        }

        if(riderId){
            if(!mongoose.isValidObjectId(riderId)){
                return res.status(400).json({
                    success: false,
                    message: "Invalid rider ID."
                });
            }

            filter.riderId = riderId;
        }

        const settlements = await codSettlementModel.find(filter).populate("branchId", "name code city").populate("riderId", "name email phone").populate("settledBy", "name email").populate("orders", "amount deliveryFee riderCashCollectedAmount deliveredAt").sort({ settlementDate: -1, createdAt: -1 });

        return res.status(200).json({
            success: true,
            settlements
        });

    } catch (error) {
        console.error("Get COD Settlements Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve COD settlements."
        });
    }
};

// Confirm cash received by branch - Admin
const confirmCodSettlement = async (req, res) => {
    try {
        const { id } = req.params;
        const { receivedAmount } = req.body;

        if(!mongoose.isValidObjectId(id)){
            return res.status(400).json({
                success: false,
                message: "Invalid settlement ID."
            });
        }

        if(receivedAmount === undefined || receivedAmount === null || receivedAmount === "" || !Number.isFinite(Number(receivedAmount)) || Number(receivedAmount) < 0){
            return res.status(400).json({
                success: false,
                message: "Enter a valid received amount."
            });
        }

        const settlement = await codSettlementModel.findById(id);

        if(!settlement){
            return res.status(404).json({
                success: false,
                message: "COD settlement not found."
            });
        }

        if(settlement.status !== "Pending"){
            return res.status(409).json({
                success: false,
                message: "This settlement has already been completed."
            });
        }

        const receivedCents = toCents(receivedAmount);
        const expectedCents = toCents(settlement.expectedAmount);

        if(receivedCents !== expectedCents){
            return res.status(400).json({
                success: false,
                message: "Received cash does not match the expected amount. Investigate the difference before confirming.",
                expectedAmount: settlement.expectedAmount,
                receivedAmount: receivedCents / 100
            });
        }

        if(!req.adminId || !mongoose.isValidObjectId(req.adminId)){
            return res.status(403).json({
                success: false,
                message: "Admin authentication is required."
            });
        }

        // Atomic update prevents duplicate settlement confirmation
        const updatedSettlement = await codSettlementModel.findOneAndUpdate(
            {
                _id: id,
                status: "Pending"
            },
            {
                $set: {
                    status: "Settled",
                    receivedAmount: receivedCents / 100,
                    settledBy: req.adminId,
                    settledAt: new Date()
                }
            },
            {
                returnDocument: "after",
                runValidators: true
            }
        );

        if(!updatedSettlement){
            return res.status(409).json({
                success: false,
                message: "Settlement was already confirmed."
            });
        }

        return res.status(200).json({
            success: true,
            message: "COD cash settlement confirmed successfully.",
            settlement: updatedSettlement
        });

    } catch (error) {
        console.error("Confirm COD Settlement Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to confirm COD settlement."
        });
    }
};

export {createCodSettlement, getCodSettlements, confirmCodSettlement};