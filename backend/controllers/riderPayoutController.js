import mongoose from "mongoose";
import orderModel from "../models/orderModel.js";
import riderModel from "../models/riderModel.js";
import branchModel from "../models/branchModel.js";
import riderPayoutModel from "../models/riderPayoutModel.js";

// Convert amounts to integer cents for safe comparisons.
const toCents = (amount) => Math.round(Number(amount) * 100);

const isValidAmount = (amount) => typeof amount === "number" && Number.isFinite(amount) && amount >= 0 && Math.abs(amount * 100 - Math.round(amount * 100)) < 0.000001;

// Separate real payments from simulated test payments.
const getPayoutAccountingCategory = (payout) => {
    const isTestPayout = payout.environment === "test" || payout.payoutMode === "Automatic Test";

    if(payout.status === "Paid"){
        return isTestPayout ? "simulatedPaid" : "realPaid";
    }

    if(payout.status === "Processing"){
        return "processing";
    }

    if(payout.status === "Failed"){
        return "failed";
    }

    return "pending";
}

const calculatePayoutSummary = (payouts) => {
    const totals = {
        totalCents: 0,
        realPaidCents: 0,
        simulatedPaidCents: 0,
        pendingCents: 0,
        processingCents: 0,
        failedCents: 0
    };

    for(const payout of payouts){
        const cents = toCents(payout.totalAmount);

        if(!Number.isSafeInteger(cents) || cents < 0){
            throw new Error("Invalid payout amount in accounting summary.");
        }

        totals.totalCents += cents;

        const category = getPayoutAccountingCategory(payout);

        if(category === "realPaid"){
            totals.realPaidCents += cents;
        } else if(category === "simulatedPaid"){
            totals.simulatedPaidCents += cents;
        } else if(category === "processing"){
            totals.processingCents += cents;
        } else if(category === "failed"){
            totals.failedCents += cents;
        } else {
            totals.pendingCents += cents;
        }
    }

    return {
        totalAmount: totals.totalCents / 100,
        paidAmount: totals.realPaidCents / 100,
        realPaidAmount: totals.realPaidCents / 100,
        simulatedPaidAmount: totals.simulatedPaidCents / 100,
        pendingAmount: totals.pendingCents / 100,
        processingAmount: totals.processingCents / 100,
        failedAmount: totals.failedCents / 100
    };
};

// Create Rider Payout — Admin Only
const createRiderPayout = async (req, res) => {
    try {
        const { branchId, riderId, orderIds, notes } = req.body;

        if(!mongoose.isValidObjectId(branchId) || !mongoose.isValidObjectId(riderId)){
            return res.status(400).json({
                success: false,
                message: "Valid branch and rider IDs are required."
            });
        }

        if(!Array.isArray(orderIds) || orderIds.length === 0 || !orderIds.every((id) => mongoose.isValidObjectId(id))){
            return res.status(400).json({
                success: false,
                message: "Select at least one valid order."
            });
        }

        const uniqueOrderIds = [...new Set(orderIds.map(String))];

        if(uniqueOrderIds.length !== orderIds.length){
            return res.status(400).json({
                success: false,
                message: "Duplicate order IDs are not allowed."
            });
        }

        const [branch, rider] = await Promise.all([
            branchModel.findById(branchId),
            riderModel.findById(riderId)
        ]);

        if(!branch){
            return res.status(404).json({
                success: false,
                message: "Branch not found."
            });
        }

        if(!rider){
            return res.status(404).json({
                success: false,
                message: "Rider not found."
            });
        }

        const orders = await orderModel.find({
            _id: { $in: uniqueOrderIds },
            branchId,
            assignedRider: riderId,
            orderStatus: "Delivered",
            paymentStatus: "Paid",
            deliveredAt: { $type: "date" },
            riderEarningCalculatedAt: { $type: "date" }
        });

        if(orders.length !== uniqueOrderIds.length){
            return res.status(400).json({
                success: false,
                message: "All selected orders must be paid, delivered, and belong to the selected branch and rider."
            });
        }

        let totalCents = 0;

        for(const order of orders){
            if(!isValidAmount(order.riderEarning)){
                return res.status(400).json({
                    success: false,
                    message: `Invalid rider earning for order ${order._id}.`
                });
            }

            totalCents += toCents(order.riderEarning);
        }

        if(!Number.isSafeInteger(totalCents) || totalCents <= 0){
            return res.status(400).json({
                success: false,
                message: "Total payout amount must be greater than zero."
            });
        }

        // Friendly duplicate check.
        // The unique database index provides the final protection.
        const existingPayout = await riderPayoutModel.findOne({
            orders: { $in: uniqueOrderIds }
        });

        if(existingPayout){
            return res.status(409).json({
                success: false,
                message: "One or more selected orders already belong to a rider payout."
            });
        }

        const payout = await riderPayoutModel.create({
            branchId,
            riderId,
            orders: uniqueOrderIds,
            totalAmount: totalCents / 100,
            status: "Pending",
            notes: typeof notes === "string" ? notes.trim().slice(0, 1000) : ""
        });

        return res.status(201).json({
            success: true,
            message: "Rider payout created successfully.",
            payout
        });

    } catch (error) {
        if(error.code === 11000){
            return res.status(409).json({
                success: false,
                message: "One or more selected orders already belong to another payout."
            });
        }

        console.error("Create Rider Payout Error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not create rider payout."
        });
    }
};

// Get Rider Payouts — Admin Only
const getRiderPayouts = async (req, res) => {
    try {
        const { branchId, riderId, status } = req.query;

        const filter = {};

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

        if(status){
            if(!["Pending", "Processing", "Paid", "Failed"].includes(status)){
                return res.status(400).json({
                    success: false,
                    message: "Invalid payout status."
                });
            }

            filter.status = status;
        }

        const payouts = await riderPayoutModel.find(filter).populate("branchId", "name code city").populate("riderId", "name email phone").populate("paidBy", "name email").sort({ createdAt: -1 });

        const summary = calculatePayoutSummary(payouts);

        return res.status(200).json({
            success: true,
            count: payouts.length,
            summary,
            payouts
        });
    } catch (error) {
        console.error("Get Rider Payouts Error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not load rider payouts."
        });
    }
};

// Confirm Rider Payout — Admin Only
const confirmRiderPayout = async (req, res) => {
    try {
        const { id } = req.params;
        const { paymentMethod, paymentReference, notes } = req.body;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid payout ID."
            });
        }

        const allowedMethods = ["Cash", "Bank Transfer", "Other"];

        if (!allowedMethods.includes(paymentMethod)) {
            return res.status(400).json({
                success: false,
                message: "Select a valid payment method."
            });
        }

        if(paymentMethod === "Bank Transfer"){
            if(typeof paymentReference !== "string" || !paymentReference.trim()){
                return res.status(400).json({
                    success: false,
                    message: "Bank transfer transaction reference is required."
                });
            }

            if(paymentReference.trim().length > 200){
                return res.status(400).json({
                    success: false,
                    message: "Transaction reference must not exceed 200 characters."
                });
            }
        }

        if(!mongoose.isValidObjectId(req.adminId)){
            return res.status(401).json({
                success: false,
                message: "Admin authentication is required."
            });
        }

        // Only manually managed payouts may be confirmed here.
        // Legacy payouts without payoutMode/environment are supported.
        const payout = await riderPayoutModel.findOneAndUpdate(
            {
                _id: id,
                status: "Pending",

                $and: [
                    {
                        $or: [
                            {
                                payoutMode: "Manual"
                            },
                            {
                                payoutMode: {
                                    $exists: false
                                }
                            }
                        ]
                    },
                    {
                        $or: [
                            {
                                environment: "manual"
                            },
                            {
                                environment: {
                                    $exists: false
                                }
                            }
                        ]
                    }
                ]
            },
            {
                $set: {
                    status: "Paid",
                    payoutMode: "Manual",
                    environment: "manual",
                    paymentMethod,
                    paymentReference: typeof paymentReference === "string" ? paymentReference.trim().slice(0, 200) : "",
                    notes: typeof notes === "string" ? notes.trim().slice(0, 1000) : "",
                    paidBy: req.adminId,
                    paidAt: new Date()
                }
            },
            {
                returnDocument: "after",
                runValidators: true
            }
        );

        if(!payout){
            const existing = await riderPayoutModel.findById(id);

            if(!existing){
                return res.status(404).json({
                    success: false,
                    message: "Rider payout not found."
                });
            }

            return res.status(409).json({
                success: false,
                message: "This payout cannot be manually confirmed. It may already be paid or assigned to automatic test processing."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Manual rider payout confirmed successfully.",
            payout
        });

    } catch (error) {
        console.error("Confirm Rider Payout Error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not confirm rider payout."
        });
    }
};

// Get My Rider Payouts — Rider Only
const getMyRiderPayouts = async (req, res) => {
    try {
        const riderId = req.riderId;

        if(!mongoose.isValidObjectId(riderId)){
            return res.status(401).json({
                success: false,
                message: "Rider authentication is required."
            });
        }

        const payouts = await riderPayoutModel.find({ riderId }).select("branchId orders totalAmount status payoutMode environment paymentMethod paymentReference paidAt createdAt").populate("branchId", "name code city").sort({ createdAt: -1 }).lean();

        const summary = calculatePayoutSummary(payouts);

        return res.status(200).json({
            success: true,
            count: payouts.length,
            summary,
            payouts: payouts.map((payout) => ({
                ...payout,
                accountingCategory: getPayoutAccountingCategory(payout),
                isSimulated: payout.environment === "test" || payout.payoutMode === "Automatic Test"
            }))
        });
    } catch (error) {
        console.error("Get My Rider Payouts Error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not load rider payout history."
        });
    }
}

// Get My Rider Earnings — Rider Only
const getMyRiderEarnings = async (req, res) => {
    try {
        const riderId = req.riderId;

        if(!mongoose.isValidObjectId(riderId)){
            return res.status(401).json({
                success: false,
                message: "Rider authentication is required."
            });
        }

        // Only completed, paid deliveries with calculated earnings
        const orders = await orderModel.find({
            assignedRider: riderId,
            orderStatus: "Delivered",
            paymentStatus: "Paid",
            deliveredAt: { $type: "date" },
            riderEarningCalculatedAt: { $type: "date" },
            riderEarning: { $type: "number", $gte: 0 }
        }).select("_id branchId riderEarning deliveredAt deliveryDistanceKm").sort({ deliveredAt: -1 }).lean();

        // Existing payout batches for this rider
        const payouts = await riderPayoutModel.find({ riderId }).select("orders totalAmount status payoutMode environment").lean();

        // Track orders already included in payout batches
        const batchedOrderIds = new Set();

        for(const payout of payouts){
            for(const orderId of payout.orders){
                batchedOrderIds.add(String(orderId));
            }
        }

        // Separate real and simulated payout accounting
        const payoutSummary = calculatePayoutSummary(payouts);

        let totalEarningsCents = 0;
        let availableEarningsCents = 0;
        let availableOrdersCount = 0;

        for(const order of orders){
            const cents = toCents(order.riderEarning);

            if(!Number.isSafeInteger(cents) || cents < 0){
                continue;
            }

            totalEarningsCents += cents;

            if(!batchedOrderIds.has(String(order._id))){
                availableEarningsCents += cents;
                availableOrdersCount++;
            }
        }

        return res.status(200).json({
            success: true,

            summary: {
                totalEarnings: totalEarningsCents / 100,
                availableEarnings: availableEarningsCents / 100,

                pendingPayouts: payoutSummary.pendingAmount,
                processingPayouts: payoutSummary.processingAmount,
                failedPayouts: payoutSummary.failedAmount,

                totalPaid: payoutSummary.realPaidAmount,
                realPaidPayouts: payoutSummary.realPaidAmount,
                simulatedPaidPayouts: payoutSummary.simulatedPaidAmount,

                completedDeliveries: orders.length,
                availableOrders: availableOrdersCount
            },

            recentDeliveries: orders.slice(0, 10).map((order) => ({
                orderId: order._id,
                branchId: order.branchId,
                earning: order.riderEarning,
                deliveredAt: order.deliveredAt,
                deliveryDistanceKm: order.deliveryDistanceKm,
                payoutStatus: batchedOrderIds.has(String(order._id)) ? "In Payout" : "Available"
            }))
        });
        
    } catch (error) {
        console.error("Get My Rider Earnings Error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not load rider earnings."
        });
    }
}

export { createRiderPayout, getRiderPayouts, confirmRiderPayout, getMyRiderPayouts, getMyRiderEarnings };