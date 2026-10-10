import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";
import foodModel from "../models/foodModel.js";

const getDashboardData = async (req, res) => {
    
    try {
        
        // Total Orders
        const totalOrders = await orderModel.countDocuments();

        // Total Customers
        const totalCustomers = await userModel.countDocuments();

        // Total Food Items
        const totalFoodItems = await foodModel.countDocuments();

        // Get all paid orders
        const paidOrders = await orderModel.find({
            paymentStatus: "Paid"
        });

        // Calculate Total Revenue
        const totalRevenue = paidOrders.reduce(
            (total, order) => total + Number(order.amount), 0
        );

        // Order Status Count
        const pending = await orderModel.countDocuments({
            orderStatus: "Pending"
        });

        const processing = await orderModel.countDocuments({
            orderStatus: "Processing"
        });

        const outForDelivery = await orderModel.countDocuments({
            orderStatus: "Out for Delivery"
        });

        const delivered = await orderModel.countDocuments({
            orderStatus: "Delivered"
        });

        const cancelled = await orderModel.countDocuments({
            orderStatus: "Cancelled"
        });

        // Recent Orders
        const recentOrders = await orderModel .find({}) .populate("userId", "name email") .sort({ createdAt: -1 }) .limit(5);

        res.status(200).json({
            success: true,
            data: {
                totalOrders,
                totalCustomers,
                totalFoodItems,
                totalRevenue,

                orderStatus: {
                    pending,
                    processing,
                    outForDelivery,
                    delivered,
                    cancelled
                },
                
                recentOrders
            }
        });

    } catch (error) {

        console.log("Dashboard Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to load dashboard data."
        });

    }

}

export { getDashboardData };