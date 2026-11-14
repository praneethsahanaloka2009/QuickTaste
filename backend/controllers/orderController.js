import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";
import foodModel from "../models/foodModel.js";
import riderEarningsSettingsModel from "../models/riderEarningsSettingsModel.js";
import { recordMembershipSavings } from "../utils/membershipSavings.js";

// Create Paid Order
const createOrder = async (req, res) => {
    try {
        const {firstName, lastName, email, street, city, state, zipCode, country, phone, stripeSessionId} = req.body;

        // Check delivery information
        if(!firstName || !lastName || !email || !street || !city || !state || !zipCode || !country || !phone) {
            return res.status(400).json({
                success: false,
                message: "Please complete all delivery information!"
            });
        }

        // Check Stripe Session ID
        if(!stripeSessionId) {
            return res.status(400).json({
                success: false,
                message: "Stripe session ID is required!"
            });
        }

        // Check if this Stripe payment was already used
        const existingOrder = await orderModel.findOne({
            stripeSessionId: stripeSessionId
        });

        if(existingOrder) {
            return res.status(200).json({
                success: true,
                message: "Order already created.",
                order: existingOrder
            });
        }

        // Get logged-in user
        const user = await userModel.findById(req.userId);

        if(!user) {
            return res.status(404).json({
                success: false,
                message: "User not found!"
            });
        }

        // Check Cart
        if(!user.cartData || Object.keys(user.cartData).length === 0){
            return res.status(400).json({
                success: false,
                message: "Your cart is empty!"
            });
        }

        // Get cart item IDs
        const cartItems = Object.keys(user.cartData);

        // Get food details from MongoDB
        const foods = await foodModel.find({
            _id: { $in: cartItems }
        });

        // Check if all cart items still exist
        if(foods.length !== cartItems.length) {
            return res.status(400).json({
                success: false,
                message: "Some food items in your cart are no longer available."
            });
        }

        // Create order items array
        const orderItems = [];

        // Calculate subtotal securely from database
        let subtotal = 0;

        for(const food of foods) {
            const quantity = Number(
                user.cartData[food._id.toString()]
            );

            if (quantity > 0) {
                subtotal += Number(food.price) * quantity;

                orderItems.push({
                    foodId: food._id,
                    name: food.name,
                    price: Number(food.price),
                    quantity: quantity,
                    preparationTime: Number(food.preparationTime) || 15
                });
            }
        }

        // Check order items
        if(orderItems.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid cart!"
            });
        }

        // Check subtotal
        if(subtotal <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid cart amount!"
            });
        }

        // Delivery fee
        const deliveryFee = 2;

        // Final order amount
        const totalAmount = subtotal + deliveryFee;

        // Create Order
        const newOrder = new orderModel({
            userId: req.userId,

            // Save items as an array
            items: orderItems,

            amount: totalAmount,

            deliveryFee: deliveryFee,

            address: {
                firstName: firstName,
                lastName: lastName,
                email: email,
                street: street,
                city: city,
                state: state,
                zipCode: zipCode,
                country: country,
                phone: phone
            },

            paymentStatus: "Paid",
            paymentMethod: "Stripe",
            stripeSessionId: stripeSessionId,
            orderStatus: "Pending",
            preparationStartedAt: null
        });

        // Save order
        const order = await newOrder.save();

        // Clear cart after successful order creation
        user.cartData = {};
        user.markModified("cartData");
        await user.save();

        // Send response
        res.status(201).json({
            success: true,
            message: "Order created successfully!",
            order
        });

    } catch (error) {

        console.log("Create Order Error:", error);

        res.status(500).json({
            success: false,
            message: "Error creating order"
        });
    }
};

// Get User Orders
const getUserOrders = async (req, res) => {
    try {
        const orders = await orderModel
            .find({ userId: req.userId })
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            orders
        });

    } catch (error) {

        console.log("Get User Orders Error:", error);

        res.status(500).json({
            success: false,
            message: "Error getting orders"
        });
    }
};

// Get Single Order
const getOrderById = async (req, res) => {
    try {
        const { id } = req.params;

        const order = await orderModel.findOne({
            _id: id,
            userId: req.userId
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found!"
            });
        }

        res.status(200).json({
            success: true,
            order
        });

    } catch (error) {

        console.log("Get Order Error:", error);

        res.status(500).json({
            success: false,
            message: "Error getting order"
        });
    }
};

// Get All Orders For Admin
const getAllOrders = async (req, res) => {
    try {
        const orders = await orderModel.find({}).populate("userId", "name email").populate("branchId", "name code city deliveryRadiusKm").populate("assignedRider", "name email").sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            orders
        });

    } catch (error) {
        console.log("Get All Orders Error:", error);

        res.status(500).json({
            success: false,
            message: "Error getting all orders"
        });
    }
}

// Cancel Order - Customer
const cancelOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        // Allowed customer cancellation reasons
        const allowedReasons = ["Changed my mind", "Ordered by mistake", "Order taking too long", "No longer needed", "Found another option"];

        // Check reason
        if (!reason || typeof reason !== "string"){
            return res.status(400).json({
                success: false,
                message: "Please select a cancellation reason."
            });
        }

        // Check if reason is one of the predefined options
        // "Other" is handled separately below.
        if(!allowedReasons.includes(reason) && !reason.startsWith("Other:")){
            return res.status(400).json({
                success: false,
                message: "Invalid cancellation reason."
            });
        }

        // Find only the logged-in customer's own order
        const order = await orderModel.findOne({
            _id: id,
            userId: req.userId
        })

        if(!order){
            return res.status(404).json({
                success: false,
                message: "Order not found."
            })
        }

        // Customer can cancel only Pending or Processing orders
        if(order.orderStatus !== "Pending" && order.orderStatus !== "Processing"){
            return res.status(400).json({
                success: false,
                message: "This order can no longer be cancelled."
            })
        }

        // Check if already cancelled
        if(order.orderStatus === "Cancelled"){
            return res.status(400).json({
                success: false,
                message: "This order has already been cancelled."
            });
        }

        // Update cancellation details
        order.orderStatus = "Cancelled";
        order.cancelledBy = "Customer";
        order.cancellationReason = reason;
        order.cancelledAt = new Date();

        // Save cancelled order
        await order.save();

        res.status(200).json({
            success: true,
            message: "Order cancelled successfully.",
            order
        });

    } catch (error) {
        
        console.log("Cancel Order Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to cancel order."
        });

    }

};

// Update Order Status - Admin
const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const order = await orderModel.findById(id).populate("userId", "name email").populate("branchId", "name code city deliveryRadiusKm");

        if(!order){
            return res.status(404).json({
                success: false,
                message: "Order not found."
            });
        }

        if(order.orderStatus === "Cancelled" || order.orderStatus === "Delivered"){
            return res.status(400).json({
                success: false,
                message: "This order can no longer be changed."
            });
        }

        // Admin accepts the order: start preparation timer
        if (order.orderStatus === "Pending" && status === "Processing"){
            order.orderStatus = "Processing";
            order.preparationStartedAt = new Date();

            await order.save();

            return res.status(200).json({
                success: true,
                message: "Order accepted. Food preparation has started.",
                order
            });
        }

        // Allow Out for Delivery only after preparation time
        if (order.orderStatus === "Processing" && status === "Out for Delivery"){
            if (!order.preparationStartedAt) {
                return res.status(400).json({
                    success: false,
                    message: "Preparation has not started yet."
                });
            }

            const totalPreparationMinutes = order.items.reduce(
                (total, item) => {
                    const minutes = Number(item.preparationTime) || 15;
                    const quantity = Number(item.quantity) || 1;

                    return total + minutes * quantity;
                },
                0
            );

            const preparationEndTime = new Date(order.preparationStartedAt).getTime() + totalPreparationMinutes * 60 * 1000;

            if(Date.now() < preparationEndTime){
                const remainingMs = preparationEndTime - Date.now();
                const remainingMinutes = Math.ceil(
                    remainingMs / (60 * 1000)
                );

                return res.status(400).json({
                    success: false,
                    message: `Food is still being prepared. Please wait approximately ${remainingMinutes} more minute(s).`
                });
            }

            order.orderStatus = "Out for Delivery";
            await order.save();

            return res.status(200).json({
                success: true,
                message: "Order is out for delivery.",
                order
            });
        }

        // Mark delivered only after rider confirmation
        if(order.orderStatus === "Out for Delivery" && status === "Delivered"){
            // Ensure a rider is assigned
            if(!order.assignedRider){
                return res.status(400).json({
                    success: false,
                    message: "Assign a rider before completing this order."
                });
            }

            // Rider must confirm delivery first
            if(!order.riderDeliveryConfirmedAt){
                return res.status(400).json({
                    success: false,
                    message: "Rider has not confirmed delivery yet."
                });
            }

            // COD cash collection must be confirmed
            if(order.paymentMethod === "Cash on Delivery"){
                if(!order.riderCashCollected){
                    return res.status(400).json({
                        success: false,
                        message: "Rider has not confirmed COD cash collection."
                    });
                }
            } else if(order.paymentStatus !== "Paid") {
                return res.status(400).json({
                    success: false,
                    message: "Payment has not been confirmed."
                });
            }

            // Require customer OTP verification
            if(!order.deliveryOtpVerifiedAt){
                return res.status(400).json({
                    success: false,
                    message: "Customer delivery OTP has not been verified."
                });
            }

            // Read the current admin-controlled earning
            const settings = await riderEarningsSettingsModel.findOne({ key: "global" });

            const defaultEarning = settings?.defaultEarning ?? 2;

            const earning = Number(defaultEarning);

            if(!Number.isFinite(earning) || earning < 0){
                return res.status(500).json({
                    success: false,
                    message: "Invalid rider earnings configuration."
                });
            }

            const completedAt = new Date();

            // Atomic update prevents duplicate earnings and rechecks delivery/payment conditions.
            const updatedOrder = await orderModel.findOneAndUpdate(
                {
                    _id: order._id,
                    orderStatus: "Out for Delivery",
                    assignedRider: order.assignedRider,

                    riderDeliveryConfirmedAt: {
                        $type: "date"
                    },

                    deliveryOtpVerifiedAt: {
                        $type: "date"
                    },

                    riderEarningCalculatedAt: null,

                    ...(order.paymentMethod === "Cash on Delivery"
                        ? {
                            paymentMethod: "Cash on Delivery",
                            riderCashCollected: true
                        } : {
                            paymentMethod: order.paymentMethod,
                            paymentStatus: "Paid"
                        })
                },
                {
                    $set: {
                        orderStatus: "Delivered",
                        deliveredAt: completedAt,
                        riderEarning: earning,
                        riderEarningCalculatedAt: completedAt
                    }
                },
                {
                    returnDocument: "after",
                    runValidators: true
                }
            );

            if(!updatedOrder){
                return res.status(409).json({
                    success: false,
                    message: "Order was already completed or its delivery details changed."
                });
            }

            // Record COD membership savings after confirmed delivery.
            // Do not undo a successfully completed delivery if tracking fails.
            if(updatedOrder.paymentMethod === "Cash on Delivery" && updatedOrder.membershipId){
                try {
                    const savingsResult = await recordMembershipSavings(updatedOrder._id);

                    if(savingsResult.counted){
                        console.log(`COD membership savings recorded: $${savingsResult.savings.toFixed(2)}`);
                    }
                } catch (error) {
                    console.error("COD membership savings tracking error:", error.message);
                }
            }

            return res.status(200).json({
                success: true,
                message: "Order delivered and rider earnings recorded successfully.",
                order: updatedOrder
            });
        }

        return res.status(400).json({
            success: false,
            message: "This status transition is not allowed."
        });

    } catch (error) {
        console.log("Update Order Status Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update order status."
        });
    }
}

export {createOrder, getUserOrders, getOrderById, getAllOrders, cancelOrder, updateOrderStatus};