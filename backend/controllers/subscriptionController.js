import membershipPlanModel from "../models/membershipPlanModel.js";
import subscriptionModel from "../models/subscriptionModel.js";
import subscriptionPaymentModel from "../models/subscriptionPaymentModel.js";

// Default QuickTaste membership plans
const defaultPlans = [
    {
        name: "Basic",
        price: 2.99,
        currency: "USD",
        billingInterval: "month",
        description: "Essential savings for everyday orders.",
        deliveryDiscountPercentage: 50,
        foodDiscountPercentage: 0,
        benefits: [
            "50% off standard delivery fees",
            "Exclusive Basic member offers",
            "Membership dashboard",
            "Automatic monthly renewal",
            "Cancel renewal anytime"
        ],
        isActive: true
    },
    {
        name: "Plus",
        price: 4.99,
        currency: "USD",
        billingInterval: "month",
        description: "More savings on your favorite food.",
        deliveryDiscountPercentage: 100,
        foodDiscountPercentage: 5,
        benefits: [
            "Free delivery on eligible orders",
            "5% off eligible food items",
            "Exclusive Plus member offers",
            "Membership dashboard",
            "Automatic monthly renewal",
            "Cancel renewal anytime"
        ],
        isActive: true
    },
    {
        name: "Premium",
        price: 8.99,
        currency: "USD",
        billingInterval: "month",
        description: "The ultimate QuickTaste experience.",
        deliveryDiscountPercentage: 100,
        foodDiscountPercentage: 10,
        benefits: [
            "Free delivery on eligible orders",
            "10% off eligible food items",
            "Premium exclusive offers",
            "Birthday rewards",
            "Priority customer support",
            "Automatic monthly renewal",
            "Cancel renewal anytime"
        ],
        isActive: true
    }
];

// Expire memberships after Stripe confirms subscription cancellation or termination.
// Do not expire active recurring subscriptions solely because the locally stored billing period has ended.
const expireMemberships = async (userId = null) => {
    // Monthly recurring memberships are managed through verified Stripe webhook events.
    // Do not automatically expire memberships here.
    return {
        acknowledged: true,
        modifiedCount: 0
    };
};

// Create default plans (admin only)
const initializeMembershipPlans = async (req, res) => {
    try {
        let created = 0;
        let existing = 0;

        for(const plan of defaultPlans){
            const result = await membershipPlanModel.updateOne(
                {
                    name: plan.name
                },
                {
                    $setOnInsert: plan
                },
                {
                    upsert: true
                }
            );

            if(result.upsertedCount > 0){
                created++;
            } else {
                existing++;
            }
        }

        return res.status(200).json({
            success: true,
            message: "Membership plans initialized successfully.",
            created,
            existing
        });
        
    } catch (error) {
        console.error("Initialize membership plans error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to initialize membership plans."
        });
    }
};

// Public: Get all active membership plans
const getMembershipPlans = async (req, res) => {
    try {
        const plans = await membershipPlanModel.find({ isActive: true }).select("-__v").lean();

        const order = {
            Basic: 1,
            Plus: 2,
            Premium: 3
        };

        plans.sort(
            (a, b) => order[a.name] - order[b.name]
        );

        return res.status(200).json({
            success: true,
            plans
        });

    } catch (error) {
        console.error("Get membership plans error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load membership plans."
        });
    }
};

// Customer: Get current active membership
const getMySubscription = async (req, res) => {
    try {
        const userId = req.userId;

        if(!userId){
            return res.status(401).json({
                success: false,
                message: "Authentication required."
            });
        }

        // Subscription status will be synchronized through Stripe webhooks.
        await expireMemberships(userId);

        const subscription = await subscriptionModel.findOne({userId, status: {$in: ["active", "past_due"]}}).populate("planId").sort({ createdAt: -1 }).lean();

        return res.status(200).json({
            success: true,
            subscription: subscription || null,
            message: subscription ? "Active membership found." : "No active membership found."
        });

    } catch (error) {
        console.error("Get my subscription error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load membership details."
        });
    }
};

// Customer: Get complete membership purchase history
const getMyMembershipHistory = async (req, res) => {
    try {
        const userId = req.userId;

        if(!userId){
            return res.status(401).json({
                success: false,
                message: "Authentication required."
            });
        }

        await expireMemberships(userId);

        const subscriptions = await subscriptionModel.find({userId, status: {$in: ["active", "past_due", "expired", "cancelled"]}}).populate("planId", "name price currency benefits").sort({ startDate: -1, createdAt: -1 }).lean();

        const now = new Date();

        let totalPurchasedDays = 0;
        let totalActiveDays = 0;

        const history = subscriptions.map((subscription) => {
            const start = subscription.startDate ? new Date(subscription.startDate) : null;

            const end = subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null;

            let purchasedDays = 0;
            let activeDays = 0;

            if(start && end && end > start){
                purchasedDays = Math.ceil((end.getTime() - start.getTime()) / 86400000);

                const effectiveEnd = end < now ? end : now;

                if(effectiveEnd > start){
                    activeDays = Math.floor((effectiveEnd.getTime() - start.getTime()) / 86400000);
                }
            }

            totalPurchasedDays += purchasedDays;
            totalActiveDays += activeDays;

            return {
                ...subscription, purchasedDays, activeDays
            };
        });

        return res.status(200).json({
            success: true,
            history,
            summary: {
                totalMemberships: history.length,
                totalPurchasedDays,
                totalActiveDays
            }
        });

    } catch (error) {
        console.error("Membership History Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load membership history."
        });
    }
}

// Customer: Get membership payment history
const getMyMembershipPayments = async (req, res) => {
    try {
        const userId = req.userId;

        if(!userId){
            return res.status(401).json({
                success: false,
                message: "Authentication required."
            });
        }

        const payments = await subscriptionPaymentModel.find({ userId }).populate("planId", "name price currency").sort({ paidAt: -1, createdAt: -1 }).lean();

        const paidPayments = payments.filter((payment) => payment.paymentStatus === "Paid");

        const totalPaid = paidPayments.reduce((total, payment) => total + Number(payment.amount || 0), 0);

        return res.status(200).json({
            success: true,
            payments,
            summary: {
                totalPayments: paidPayments.length,
                totalPaid: Number(totalPaid.toFixed(2)),
                currency: "USD"
            }
        });
    } catch (error) {
        console.error("Membership Payment History Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load membership payment history."
        });
    }
};

export { expireMemberships, initializeMembershipPlans, getMembershipPlans, getMySubscription, getMyMembershipHistory, getMyMembershipPayments }