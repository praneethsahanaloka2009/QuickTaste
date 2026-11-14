import mongoose from "mongoose";
import orderModel from "../models/orderModel.js";

// Admin approves a customer-requested delivery location
const approveCustomerLocation = async (req, res) => {
    try {
        const { id } = req.params;

        if(!mongoose.isValidObjectId(id)){
            return res.status(400).json({
                success: false,
                message: "Invalid order ID."
            });
        }

        const order = await orderModel.findOneAndUpdate(
            {
                _id: id,
                orderStatus: "Out for Delivery",
                locationChangeStatus: "Pending",
                "customerConfirmedLocation.latitude": {
                    $gte: -90,
                    $lte: 90,
                    $ne: null
                },
                "customerConfirmedLocation.longitude": {
                    $gte: -180,
                    $lte: 180,
                    $ne: null
                },
                "customerConfirmedLocation.confirmedAt": {
                    $type: "date"
                }
            },
            {
                $set: {
                    locationChangeStatus: "Approved"
                }
            },
            {
                returnDocument: "after",
                runValidators: true
            }
        );

        if(!order){
            return res.status(409).json({
                success: false,
                message: "No pending location request is eligible for approval."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Customer delivery location approved successfully.",
            locationChangeStatus: order.locationChangeStatus,
            order
        });

    } catch (error) {
        console.error("Approve Customer Location Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to approve customer location."
        });
    }
};

// Admin rejects a customer-requested delivery location
const rejectCustomerLocation = async (req, res) => {
    try {
        const { id } = req.params;

        if(!mongoose.isValidObjectId(id)){
            return res.status(400).json({
                success: false,
                message: "Invalid order ID."
            });
        }

        const order = await orderModel.findOneAndUpdate(
            {
                _id: id,
                orderStatus: "Out for Delivery",
                locationChangeStatus: "Pending"
            },
            {
                $set: {
                    locationChangeStatus: "Rejected"
                }
            },
            {
                returnDocument: "after",
                runValidators: true
            }
        );

        if(!order){
            return res.status(409).json({
                success: false,
                message: "No pending location request is eligible for rejection."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Customer location change request rejected.",
            locationChangeStatus: order.locationChangeStatus,
            order
        });

    } catch (error) {
        console.error("Reject Customer Location Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to reject customer location."
        });
    }
};

export {approveCustomerLocation, rejectCustomerLocation};