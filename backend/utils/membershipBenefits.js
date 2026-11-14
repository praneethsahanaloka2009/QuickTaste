import subscriptionModel from "../models/subscriptionModel.js";

// Return currently eligible membership benefits.
// Never trust a membership status supplied by the frontend.
export const getMembershipBenefits = async (userId) => {
    const noBenefits = {
        membershipId: null,
        planId: null,
        planName: null,
        foodDiscountPercentage: 0,
        deliveryDiscountPercentage: 0
    };

    if(!userId){
        return noBenefits;
    }

    const membership = await subscriptionModel.findOne({ userId, status: "active", paymentStatus: "Paid", currentPeriodEnd: { $gt: new Date() } }).sort({ createdAt: -1 }).populate("planId");

    if(!membership || !membership.planId){
        return noBenefits;
    }

    const plan = membership.planId;

    const safePercentage = (value) => {
        const number = Number(value);

        if(!Number.isFinite(number)){
            return 0;
        }

        return Math.min(100, Math.max(0, number));
    };

    return {
        membershipId: membership._id,
        planId: plan._id,
        planName: plan.name,
        foodDiscountPercentage: safePercentage(
            plan.foodDiscountPercentage
        ),
        deliveryDiscountPercentage: safePercentage(
            plan.deliveryDiscountPercentage
        )
    };
};