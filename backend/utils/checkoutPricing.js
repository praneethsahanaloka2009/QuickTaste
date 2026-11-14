import { getMembershipBenefits } from "./membershipBenefits.js";

const DELIVERY_FEE = 2;

const roundMoney = (value) => {
    return Number(Number(value).toFixed(2));
};

export const calculateCheckoutPricing = async ({ userId, subtotal, promoDiscountAmount = 0, promoFreeDelivery = false }) => {
    if(!Number.isFinite(subtotal) || subtotal < 0){
        throw new Error("Invalid cart subtotal.");
    }

    const membership = await getMembershipBenefits(userId);

    const foodDiscountPercentage = membership.foodDiscountPercentage;

    const deliveryDiscountPercentage = membership.deliveryDiscountPercentage;

    // Membership food discount
    const membershipFoodDiscount = roundMoney(subtotal * foodDiscountPercentage / 100);

    // Apply promo discount without exceeding subtotal
    const remainingFoodTotal = Math.max(0, subtotal - membershipFoodDiscount);

    const appliedPromoDiscount = roundMoney(Math.min(remainingFoodTotal, Math.max(0, promoDiscountAmount)));

    const discountedSubtotal = roundMoney(remainingFoodTotal - appliedPromoDiscount);

    // Existing free-delivery rules have priority.
    const qualifiesForFreeDelivery = subtotal >= 25 || promoFreeDelivery === true;

    const deliveryFee = qualifiesForFreeDelivery ? 0 : roundMoney(DELIVERY_FEE * (1 - deliveryDiscountPercentage / 100));

    const deliveryDiscountAmount = roundMoney(DELIVERY_FEE - deliveryFee);

    const membershipDeliverySavings = qualifiesForFreeDelivery ? 0 : deliveryDiscountAmount;

    const membershipSavings = roundMoney(membershipFoodDiscount + membershipDeliverySavings);

    const totalDiscountAmount = roundMoney(membershipFoodDiscount + appliedPromoDiscount);

    const total = roundMoney(discountedSubtotal + deliveryFee);

    return {subtotal, discountedSubtotal, discountAmount: totalDiscountAmount, promoDiscountAmount: appliedPromoDiscount, membershipFoodDiscount, membershipDeliverySavings, membershipSavings, deliveryDiscountAmount, deliveryFee, total, membership};
}