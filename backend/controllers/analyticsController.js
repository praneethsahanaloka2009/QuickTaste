import orderModel from "../models/orderModel.js";
import foodModel from "../models/foodModel.js";

// GET /api/analytics/overview
const getAnalyticsOverview = async (req, res) => {
    try {
        const [result] = await orderModel.aggregate([
            {
                $group: {
                    _id: null,

                    totalOrders: {
                        $sum: 1
                    },

                    paidOrders: {
                        $sum: {
                            $cond: [
                                {
                                    $eq: ["$paymentStatus", "Paid"]
                                },
                                1,
                                0
                            ]
                        }
                    },

                    deliveredOrders: {
                        $sum: {
                            $cond: [
                                {
                                    $eq: ["$orderStatus", "Delivered"]
                                },
                                1,
                                0
                            ]
                        }
                    },

                    cancelledOrders: {
                        $sum: {
                            $cond: [
                                {
                                    $eq: ["$orderStatus", "Cancelled"]
                                },
                                1,
                                0
                            ]
                        }
                    },

                    // Includes paid and fully refunded orders
                    // to preserve original sales history.
                    recordedRevenue: {
                        $sum: {
                            $cond: [
                                {
                                    $in: ["$paymentStatus", ["Paid", "Refunded"]]
                                },
                                {
                                    $add: [
                                        {
                                            $ifNull: ["$amount", 0]
                                        },
                                        {
                                            $ifNull: ["$deliveryFee", 0]
                                        }
                                    ]
                                },
                                0
                            ]
                        }
                    },

                    // Only successfully completed refunds
                    completedRefunds: {
                        $sum: {
                            $cond: [
                                {
                                    $eq: ["$refundStatus", "Refunded"]
                                },
                                {
                                    $ifNull: ["$refundAmount", 0]
                                },
                                0
                            ]
                        }
                    },

                    totalDiscounts: {
                        $sum: {
                            $cond: [
                                {
                                    $in: ["$paymentStatus", ["Paid", "Refunded"]]
                                },
                                {
                                    $add: [
                                        {
                                            $ifNull: ["$discountAmount", 0]
                                        },
                                        {
                                            $ifNull: ["$deliveryDiscountAmount", 0]
                                        }
                                    ]
                                },
                                0
                            ]
                        }
                    },

                    totalRiderEarnings: {
                        $sum: {
                            $cond: [
                                {
                                    $eq: ["$orderStatus", "Delivered"]
                                },
                                {
                                    $ifNull: ["$riderEarning", 0]
                                },
                                0
                            ]
                        }
                    },

                    paidOrderValue: {
                        $sum: {
                            $cond: [
                                {
                                    $eq: ["$paymentStatus", "Paid"]
                                },
                                {
                                    $add: [
                                        {
                                            $ifNull: ["$amount", 0]
                                        },
                                        {
                                            $ifNull: ["$deliveryFee", 0]
                                        }
                                    ]
                                },
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        const data = result || {};

        const totalOrders = data.totalOrders || 0;
        const paidOrders = data.paidOrders || 0;
        const deliveredOrders = data.deliveredOrders || 0;
        const cancelledOrders = data.cancelledOrders || 0;

        const recordedRevenue = data.recordedRevenue || 0;
        const completedRefunds = data.completedRefunds || 0;

        const netRevenue = recordedRevenue - completedRefunds;

        const averageOrderValue = paidOrders > 0 ? (data.paidOrderValue || 0) / paidOrders : 0;

        const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

        return res.status(200).json({
            success: true,
            data: {
                currency: "USD",

                totalOrders,
                paidOrders,
                deliveredOrders,
                cancelledOrders,

                recordedRevenue: roundMoney(recordedRevenue),
                completedRefunds: roundMoney(completedRefunds),
                netRevenue: roundMoney(netRevenue),

                averageOrderValue: roundMoney(averageOrderValue),

                totalDiscounts: roundMoney(data.totalDiscounts || 0),

                totalRiderEarnings: roundMoney(data.totalRiderEarnings || 0)
            }
        });
    } catch (error) {
        console.error("Analytics Overview Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load analytics overview."
        });
    }
};

// GET /api/analytics/revenue
const getRevenueAnalytics = async (req, res) => {
    try {
        const { period = "30d", startDate, endDate } = req.query;

        const now = new Date();
        let start;
        let end;
        let groupFormat = "%Y-%m-%d";

        const validPeriods = ["7d", "30d", "90d", "12m", "custom"];

        if(!validPeriods.includes(period)){
            return res.status(400).json({
                success: false,
                message: "Invalid analytics period."
            });
        }

        if(period === "custom"){
            const datePattern = /^\d{4}-\d{2}-\d{2}$/;

            const parseDate = (value) => {
                if(!datePattern.test(value || "")){
                    return null;
                }

                const date = new Date(`${value}T00:00:00.000Z`);

                if(Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value){
                    return null;
                }

                return date;
            };

            start = parseDate(startDate);
            const endDay = parseDate(endDate);

            if(!start || !endDay || start > endDay){
                return res.status(400).json({
                    success: false,
                    message: "Provide valid startDate and endDate."
                });
            }

            end = new Date(endDay);
            end.setUTCDate(end.getUTCDate() + 1);

            const rangeDays = (end.getTime() - start.getTime()) / 86400000;

            if(rangeDays > 366){
                return res.status(400).json({
                    success: false,
                    message: "Maximum custom range is 366 days."
                });
            }
        } else {
            end = now;

            if(period === "12m"){
                start = new Date(now);
                start.setUTCMonth(start.getUTCMonth() - 12);
                groupFormat = "%Y-%m";
            } else {
                const days = Number.parseInt(period, 10);
                start = new Date(now.getTime() - days * 86400000);
            }
        }

        const [summary] = await orderModel.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: start,
                        $lt: end
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalOrders: {
                        $sum: 1
                    },

                    paidOrders: {
                        $sum: {
                            $cond: [
                                {
                                    $eq: ["$paymentStatus", "Paid"]
                                },
                                1,
                                0
                            ]
                        }
                    },

                    grossSales: {
                        $sum: {
                            $cond: [
                                {
                                    $in: [
                                        "$paymentStatus",
                                        ["Paid", "Refunded"]
                                    ]
                                },
                                {
                                    $ifNull: ["$subtotal", 0]
                                },
                                0
                            ]
                        }
                    },

                    discounts: {
                        $sum: {
                            $cond: [
                                {
                                    $in: [
                                        "$paymentStatus",
                                        ["Paid", "Refunded"]
                                    ]
                                },
                                {
                                    $add: [
                                        {
                                            $ifNull: ["$discountAmount", 0]
                                        },
                                        {
                                            $ifNull: [
                                                "$deliveryDiscountAmount",
                                                0
                                            ]
                                        }
                                    ]
                                },
                                0
                            ]
                        }
                    },

                    recordedRevenue: {
                        $sum: {
                            $cond: [
                                {
                                    $in: [
                                        "$paymentStatus",
                                        ["Paid", "Refunded"]
                                    ]
                                },
                                {
                                    $add: [
                                        {
                                            $ifNull: ["$amount", 0]
                                        },
                                        {
                                            $ifNull: ["$deliveryFee", 0]
                                        }
                                    ]
                                },
                                0
                            ]
                        }
                    },

                    refunds: {
                        $sum: {
                            $cond: [
                                {
                                    $eq: ["$refundStatus", "Refunded"]
                                },
                                {
                                    $ifNull: ["$refundAmount", 0]
                                },
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        const dailyData = await orderModel.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: start,
                        $lt: end
                    },
                    paymentStatus: {
                        $in: ["Paid", "Refunded"]
                    }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: groupFormat,
                            date: "$createdAt",
                            timezone: "UTC"
                        }
                    },
                    revenue: {
                        $sum: {
                            $add: [
                                {
                                    $ifNull: ["$amount", 0]
                                },
                                {
                                    $ifNull: ["$deliveryFee", 0]
                                }
                            ]
                        }
                    },
                    refunds: {
                        $sum: {
                            $cond: [
                                {
                                    $eq: ["$refundStatus", "Refunded"]
                                },
                                {
                                    $ifNull: ["$refundAmount", 0]
                                },
                                0
                            ]
                        }
                    },
                    orders: {
                        $sum: 1
                    }
                }
            },
            {
                $sort: {
                    _id: 1
                }
            }
        ]);

        const roundMoney = (value) => {
            return Math.round((value + Number.EPSILON) * 100) / 100;
        }

        const chart = dailyData.map((item) => ({
            date: item._id,
            revenue: roundMoney(item.revenue),
            refunds: roundMoney(item.refunds),
            netRevenue: roundMoney(item.revenue - item.refunds),
            orders: item.orders
        }));

        const totals = summary || {};

        return res.status(200).json({
            success: true,
            data: {
                currency: "USD",
                period,
                dateBasis: "orderCreatedAt",
                timezone: "UTC",
                startDate: start.toISOString(),
                endDateExclusive: end.toISOString(),

                summary: {
                    totalOrders: totals.totalOrders || 0,
                    paidOrders: totals.paidOrders || 0,
                    grossSales: roundMoney(totals.grossSales || 0),
                    discounts: roundMoney(totals.discounts || 0),
                    recordedRevenue: roundMoney(totals.recordedRevenue || 0),
                    refunds: roundMoney(totals.refunds || 0),
                    netRevenue: roundMoney((totals.recordedRevenue || 0) - (totals.refunds || 0))
                },

                chart
            }
        });

    } catch (error) {
        console.error("Revenue Analytics Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load revenue analytics."
        });
    }
};

// GET /api/analytics/orders
const getOrderAnalytics = async (req, res) => {
    try {
        const { period = "30d", startDate, endDate } = req.query;

        const validPeriods = ["7d", "30d", "90d", "12m", "custom"];

        if(!validPeriods.includes(period)){
            return res.status(400).json({
                success: false,
                message: "Invalid analytics period."
            });
        }

        const now = new Date();

        let start;
        let end;
        let groupFormat = "%Y-%m-%d";

        if(period === "custom"){
            const datePattern = /^\d{4}-\d{2}-\d{2}$/;

            const parseDate = (value) => {
                if(typeof value !== "string" || !datePattern.test(value)){
                    return null;
                }

                const date = new Date(`${value}T00:00:00.000Z`);

                if(Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value){
                    return null;
                }

                return date;
            };

            start = parseDate(startDate);
            const endDay = parseDate(endDate);

            if(!start || !endDay || start > endDay){
                return res.status(400).json({
                    success: false,
                    message: "Provide valid startDate and endDate."
                });
            }

            end = new Date(endDay);
            end.setUTCDate(end.getUTCDate() + 1);

            const rangeDays = (end.getTime() - start.getTime()) / 86400000;

            if(rangeDays > 366){
                return res.status(400).json({
                    success: false,
                    message: "Maximum custom range is 366 days."
                });
            }
        } else {
            end = now;

            if(period === "12m"){
                start = new Date(now);
                start.setUTCMonth(start.getUTCMonth() - 12);
                groupFormat = "%Y-%m";
            } else {
                const days = Number.parseInt(period, 10);

                start = new Date(now.getTime() - days * 86400000);
            }
        }

        const matchStage = {
            createdAt: {
                $gte: start,
                $lt: end
            }
        };

        const [result] = await orderModel.aggregate([
            {
                $match: matchStage
            },
            {
                $facet: {
                    summary: [
                        {
                            $group: {
                                _id: null,

                                totalOrders: {
                                    $sum: 1
                                },

                                pendingOrders: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $eq: ["$orderStatus", "Pending"]
                                            },
                                            1,
                                            0
                                        ]
                                    }
                                },

                                processingOrders: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $eq: ["$orderStatus", "Processing"]
                                            },
                                            1,
                                            0
                                        ]
                                    }
                                },

                                outForDeliveryOrders: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $eq: ["$orderStatus", "Out for Delivery"]
                                            },
                                            1,
                                            0
                                        ]
                                    }
                                },

                                deliveredOrders: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $eq: ["$orderStatus", "Delivered"]
                                            },
                                            1,
                                            0
                                        ]
                                    }
                                },

                                cancelledOrders: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $eq: ["$orderStatus", "Cancelled"]
                                            },
                                            1,
                                            0
                                        ]
                                    }
                                },

                                paidOrders: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $eq: ["$paymentStatus", "Paid"]
                                            },
                                            1,
                                            0
                                        ]
                                    }
                                },

                                paidOrderValue: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $eq: ["$paymentStatus", "Paid"]
                                            },
                                            {
                                                $add: [
                                                    {
                                                        $ifNull: ["$amount", 0]
                                                    },
                                                    {
                                                        $ifNull: ["$deliveryFee", 0]
                                                    }
                                                ]
                                            },
                                            0
                                        ]
                                    }
                                }
                            }
                        }
                    ],

                    statusDistribution: [
                        {
                            $group: {
                                _id: "$orderStatus",
                                count: {
                                    $sum: 1
                                }
                            }
                        },
                        {
                            $sort: {
                                count: -1
                            }
                        }
                    ],

                    orderTrends: [
                        {
                            $group: {
                                _id: {
                                    $dateToString: {
                                        format: groupFormat,
                                        date: "$createdAt",
                                        timezone: "UTC"
                                    }
                                },

                                totalOrders: {
                                    $sum: 1
                                },

                                deliveredOrders: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $eq: ["$orderStatus", "Delivered"]
                                            },
                                            1,
                                            0
                                        ]
                                    }
                                },

                                cancelledOrders: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $eq: ["$orderStatus", "Cancelled"]
                                            },
                                            1,
                                            0
                                        ]
                                    }
                                }
                            }
                        },
                        {
                            $sort: {
                                _id: 1
                            }
                        }
                    ]
                }
            }
        ]);

        const summary = result?.summary?.[0] || {};
        const totalOrders = summary.totalOrders || 0;
        const paidOrders = summary.paidOrders || 0;

        const deliveredOrders = summary.deliveredOrders || 0;
        const cancelledOrders = summary.cancelledOrders || 0;

        const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

        const percentage = (count) => totalOrders > 0 ? round((count / totalOrders) * 100) : 0;

        const statuses = ["Pending", "Processing", "Out for Delivery", "Delivered", "Cancelled"];

        const statusCounts = Object.fromEntries((result?.statusDistribution || []).map((item) => [item._id, item.count]));

        const statusDistribution = statuses.map((status) => ({
            status,
            count: statusCounts[status] || 0,
            percentage: percentage(statusCounts[status] || 0)
        }));

        const orderTrends = (result?.orderTrends || []).map((item) => ({
            date: item._id,
            totalOrders: item.totalOrders,
            deliveredOrders: item.deliveredOrders,
            cancelledOrders: item.cancelledOrders
        }));

        return res.status(200).json({
            success: true,
            data: {
                period,
                dateBasis: "orderCreatedAt",
                timezone: "UTC",
                startDate: start.toISOString(),
                endDateExclusive: end.toISOString(),
                summary: {
                    totalOrders,
                    pendingOrders: summary.pendingOrders || 0,
                    processingOrders: summary.processingOrders || 0,
                    outForDeliveryOrders: summary.outForDeliveryOrders || 0,
                    deliveredOrders,
                    cancelledOrders,
                    paidOrders,
                    averageOrderValue: paidOrders > 0 ? round((summary.paidOrderValue || 0) /paidOrders) : 0,
                    cancellationRate: percentage(cancelledOrders),
                    deliveryCompletionRate: percentage(deliveredOrders)
                },
                statusDistribution,
                orderTrends
            }
        });

    } catch (error) {
        console.error("Order Analytics Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load order analytics."
        });
    }
}

// GET /api/analytics/foods
const getFoodAnalytics = async (req, res) => {
    try {
        const { period = "30d", startDate, endDate } = req.query;

        const validPeriods = ["7d", "30d", "90d", "12m", "custom"];

        if(!validPeriods.includes(period)){
            return res.status(400).json({
                success: false,
                message: "Invalid analytics period."
            });
        }

        const now = new Date();
        let start;
        let end;

        if(period === "custom"){
            const parseDate = (value) => {
                if(typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)){
                    return null;
                }

                const date = new Date(`${value}T00:00:00.000Z`);

                if(Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value){
                    return null;
                }

                return date;
            };

            start = parseDate(startDate);
            const endDay = parseDate(endDate);

            if(!start || !endDay || start > endDay){
                return res.status(400).json({
                    success: false,
                    message: "Provide valid startDate and endDate."
                });
            }

            end = new Date(endDay);
            end.setUTCDate(end.getUTCDate() + 1);

            const rangeDays = (end.getTime() - start.getTime()) / 86400000;

            if(rangeDays > 366){
                return res.status(400).json({
                    success: false,
                    message: "Maximum custom range is 366 days."
                });
            }
        } else {
            end = now;

            if(period === "12m"){
                start = new Date(now);
                start.setUTCMonth(start.getUTCMonth() - 12);
            } else {
                const days = Number.parseInt(period, 10);

                start = new Date(now.getTime() - days * 86400000);
            }
        }

        // Count only recorded sales.
        // Cancelled orders are excluded.
        const matchStage = {
            createdAt: {
                $gte: start,
                $lt: end
            },
            paymentStatus: {
                $in: ["Paid", "Refunded"]
            },
            orderStatus: {
                $ne: "Cancelled"
            }
        };

        const result = await orderModel.aggregate([
            {
                $match: matchStage
            },
            {
                $unwind: "$items"
            },
            {
                $group: {
                    _id: "$items.foodId",

                    name: {
                        $first: "$items.name"
                    },

                    quantitySold: {
                        $sum: "$items.quantity"
                    },

                    grossItemSales: {
                        $sum: {
                            $multiply: [
                                "$items.price",
                                "$items.quantity"
                            ]
                        }
                    },

                    orderIds: {
                        $addToSet: "$_id"
                    }
                }
            },
            {
                $lookup: {
                    from: foodModel.collection.name,
                    localField: "_id",
                    foreignField: "_id",
                    as: "food"
                }
            },
            {
                $unwind: {
                    path: "$food",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    _id: 0,
                    foodId: "$_id",
                    name: 1,
                    category: {
                        $ifNull: [
                            "$food.category",
                            "Unknown"
                        ]
                    },
                    image: {
                        $ifNull: [
                            "$food.image",
                            null
                        ]
                    },
                    quantitySold: 1,
                    grossItemSales: 1,
                    orderCount: {
                        $size: "$orderIds"
                    }
                }
            },
            {
                $sort: {
                    quantitySold: -1,
                    grossItemSales: -1
                }
            }
        ]);

        const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

        const products = result.map((item) => ({
            foodId: item.foodId,
            name: item.name,
            category: item.category,
            image: item.image,
            quantitySold: item.quantitySold,
            grossItemSales: roundMoney(item.grossItemSales),
            orderCount: item.orderCount
        }));

        const categoryMap = new Map();

        for(const product of products){
            const category = product.category;

            if(!categoryMap.has(category)){
                categoryMap.set(category, {
                    category,
                    quantitySold: 0,
                    grossItemSales: 0
                });
            }

            const entry = categoryMap.get(category);

            entry.quantitySold += product.quantitySold;
            entry.grossItemSales += product.grossItemSales;
        }
        
        const categories = Array.from(categoryMap.values()).map((item) => ({ ...item, grossItemSales: roundMoney(item.grossItemSales) })).sort((a, b) => b.quantitySold - a.quantitySold);

        const totalItemsSold = products.reduce((sum, item) => sum + item.quantitySold, 0);

        const grossItemSales = products.reduce((sum, item) => sum + item.grossItemSales, 0);

        return res.status(200).json({
            success: true,
            data: {
                currency: "USD",
                period,
                dateBasis: "orderCreatedAt",
                timezone: "UTC",
                startDate: start.toISOString(),
                endDateExclusive: end.toISOString(),

                summary: {
                    totalItemsSold,
                    uniqueProductsSold: products.length,
                    grossItemSales: roundMoney(grossItemSales),
                    categoriesSold: categories.length
                },

                topProducts: products.slice(0, 5),
                products,
                categories
            }
        });

    } catch (error) {
        console.error("Food Analytics Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load food analytics."
        });
    }
};

export { getAnalyticsOverview, getRevenueAnalytics, getOrderAnalytics, getFoodAnalytics };