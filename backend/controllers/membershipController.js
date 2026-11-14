import membershipPlanModel from "../models/membershipPlanModel.js";

// Default QuickTaste monthly membership plans
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

// Admin: Initialize default membership plans
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

// Public: Get active membership plans
const getMembershipPlans = async (req, res) => {
    try {
        const plans = await membershipPlanModel.find({ isActive: true }).select("-__v").lean();

        const order = {
            Basic: 1,
            Plus: 2,
            Premium: 3
        };

        plans.sort((a, b) => order[a.name] - order[b.name]);

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

export { initializeMembershipPlans, getMembershipPlans };