import mongoose from "mongoose";
import Stripe from "stripe";
import nodemailer from "nodemailer";
import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";
import foodModel from "../models/foodModel.js";
import promoCodeModel from "../models/promoCodeModel.js";
import generateReceiptEmail from "../utils/receiptEmail.js";
import { selectBestBranch } from "../utils/branchSelection.js";
import { calculateCheckoutPricing } from "../utils/checkoutPricing.js";
import { recordMembershipSavings } from "../utils/membershipSavings.js";
import { reconcileStripeRefund } from "./refundController.js";
import buildCustomizedCheckoutItems from "../utils/buildCustomizedCheckoutItems.js";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// Stripe initialization
const getStripe = () => {
    if(!process.env.STRIPE_SECRET_KEY){
        throw new Error("Stripe secret key is not configured.");
    }

    return new Stripe(process.env.STRIPE_SECRET_KEY);
};

// Email transporter
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Validate customer address
const validateAddress = (formData) => {
    const requiredFields = [
        "firstName",
        "lastName",
        "email",
        "street",
        "city",
        "state",
        "zipCode",
        "country",
        "phone"
    ];

    return Boolean(
        formData && requiredFields.every((field) => typeof formData[field] === "string" && formData[field].trim().length > 0)
    );
};

// Validate GPS coordinates
const validateDeliveryLocation = (location) => {
    if(!location || typeof location !== "object"){
        return false;
    }

    const { latitude, longitude } = location;

    return (
        typeof latitude === "number" &&
        typeof longitude === "number" &&
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180
    );
};

// Get trusted cart products from MongoDB
const getCartItems = async (user) => {
    const normalCartData = user.cartData || {};

    const customizedCartData = Array.isArray(user.customizedCartData) ? user.customizedCartData : [];

    const normalItems = [];
    let normalSubtotalCents = 0;

    // Normal Cart
    for(const [foodId, quantityValue] of Object.entries(normalCartData)){
        if(!mongoose.isValidObjectId(foodId)){
            throw new Error("Invalid food ID in your cart.");
        }

        const quantity = Number(quantityValue);

        if(!Number.isInteger(quantity) || quantity < 1 || quantity > 100){
            throw new Error("Your cart contains an invalid quantity.");
        }

        const food = await foodModel.findById(foodId);

        if(!food){
            throw new Error("Some food items in your cart are no longer available.");
        }

        const priceCents = Math.round(Number(food.price) * 100);

        if(!Number.isSafeInteger(priceCents) || priceCents <= 0){
            throw new Error("Invalid food price in your cart.");
        }

        const lineTotalCents = priceCents * quantity;

        if(!Number.isSafeInteger(lineTotalCents)){
            throw new Error("Cart total is too large.");
        }

        normalSubtotalCents += lineTotalCents;

        if(!Number.isSafeInteger(normalSubtotalCents)){
            throw new Error("Cart total is too large.");
        }

        normalItems.push({
            foodId: food._id,
            name: food.name,
            price: priceCents / 100,
            quantity,
            preparationTime: Number(food.preparationTime) || 15,
            isCustomized: false,
            variantKey: "",
            basePrice: priceCents / 100,
            selectedCustomizations: []
        });
    }

    // Customized cart
    const customized = await buildCustomizedCheckoutItems(customizedCartData);

    // Combined cart
    const items = [
        ...normalItems,
        ...customized.items
    ];

    if(items.length === 0){
        throw new Error("Your cart is empty.");
    }

    const customizedSubtotalCents = Math.round(customized.subtotal * 100);

    const subtotalCents = normalSubtotalCents + customizedSubtotalCents;

    if(!Number.isSafeInteger(customizedSubtotalCents) || !Number.isSafeInteger(subtotalCents)){
        throw new Error("Cart total is too large.");
    }

    return {
        items,
        subtotal: subtotalCents / 100,
        normalSubtotal: normalSubtotalCents / 100,
        customizedSubtotal: customizedSubtotalCents / 100
    };
};

// Validate promo and calculate selected offer
const calculateDiscount = async (subtotal, promoCode, selectedOffer = 1) => {
    let discountAmount = 0;
    let appliedPromo = null;

    if(typeof promoCode !== "string" || !promoCode.trim()){
        return {
            discountAmount,
            appliedPromo,
            promoFreeDelivery: false
        };
    }

    if(![1, 2].includes(selectedOffer)){
        throw new Error("Invalid promo offer selection.");
    }

    const normalizedCode = promoCode.trim().toUpperCase();

    const promo = await promoCodeModel.findOne({
        code: normalizedCode
    });

    if(!promo){
        throw new Error("Invalid promo code.");
    }

    if(!promo.isActive){
        throw new Error("This promo code is inactive.");
    }

    if(!promo.expiryDate || new Date() > new Date(promo.expiryDate)){
        throw new Error("This promo code has expired.");
    }

    if(promo.usageLimit !== null && promo.usageLimit !== undefined && promo.usedCount >= promo.usageLimit){
        throw new Error("This promo code usage limit has been reached.");
    }

    if(subtotal < Number(promo.minOrderAmount || 0)){
        throw new Error(`Minimum order amount for this promo is $${Number(promo.minOrderAmount).toFixed(2)}.`);
    }

    const offerType = selectedOffer === 2 ? promo.discountType2 : promo.discountType;

    const offerValue = selectedOffer === 2 ? promo.discountValue2 : promo.discountValue;

    const maxDiscount = selectedOffer === 2 ? promo.maxDiscountAmount2 : promo.maxDiscountAmount;

    if(!offerType){
        throw new Error("Selected promo offer is unavailable.");
    }

    if(offerType !== "freeDelivery"){
        if(!Number.isFinite(Number(offerValue)) || Number(offerValue) < 0){
            throw new Error("Invalid promo discount value.");
        }
    }

    if(maxDiscount !== null && maxDiscount !== undefined && (!Number.isFinite(Number(maxDiscount)) || Number(maxDiscount) < 0)){
        throw new Error("Invalid maximum promo discount.");
    }

    if(offerType === "freeDelivery"){
        discountAmount = 0;
    } else if(offerType === "percentage"){
        if(Number(offerValue) > 100){
            throw new Error("Promo percentage cannot exceed 100.");
        }

        discountAmount = subtotal * (Number(offerValue) / 100);

        if(maxDiscount !== null && maxDiscount !== undefined){
            discountAmount = Math.min(discountAmount, Number(maxDiscount));
        }
    } else if(offerType === "fixed"){
        discountAmount = Number(offerValue);
    } else {
        throw new Error("Invalid promo code discount type.");
    }

    discountAmount = Number(Math.min(subtotal, Math.max(0, discountAmount)).toFixed(2));

    appliedPromo = promo;

    return {
        discountAmount,
        appliedPromo,
        selectedOffer,
        promoFreeDelivery : offerType === "freeDelivery"
    };
};

// Calculate membership and promo pricing
const getCheckoutDetails = async (user, promoCode, selectedOffer = 1) => {
    const { items, subtotal } = await getCartItems(user);

    const { discountAmount: promoDiscountAmount, appliedPromo, promoFreeDelivery = false } = await calculateDiscount(subtotal, promoCode, selectedOffer);

    const pricing = await calculateCheckoutPricing({
        userId: user._id,
        subtotal,
        promoDiscountAmount,
        promoFreeDelivery
    });

    if(!Number.isFinite(pricing.total) || pricing.total <= 0){
        throw new Error("Invalid final payment amount.");
    }

    return { items, ...pricing, appliedPromo, selectedOffer };
};

// Client-facing cart validation errors
const isCheckoutCartError = (error) => {
    if(!(error instanceof Error)){
        return false;
    }

    const message = error.message;

    const prefixes = [
        "Invalid ",
        "Your cart ",
        "Some food items ",
        "A product in your customized cart ",
        "A customization group ",
        "Duplicate ",
        "Unavailable ",
        "Cart total ",
        "Customized cart "
    ];

    return prefixes.some((prefix) => message.startsWith(prefix));
};

// Checkout Summary API
export const getCheckoutSummary = async (req, res) => {
    try {
        const userId = req.userId;

        if(!userId){
            return res.status(401).json({
                success: false,
                message: "Please log in to view checkout pricing."
            });
        }

        const user = await userModel.findById(userId);

        if(!user){
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const { promoCode = "", selectedOffer = 1 } = req.body || {};

        if(typeof promoCode !== "string" || ![1, 2].includes(selectedOffer)){
            return res.status(400).json({
                success: false,
                message: "Invalid checkout selection."
            });
        }

        const checkout = await getCheckoutDetails(user, promoCode, selectedOffer);

        return res.status(200).json({
            success: true,
            summary: {
                subtotal: checkout.subtotal,
                membershipFoodDiscount: checkout.membershipFoodDiscount,
                promoDiscountAmount: checkout.promoDiscountAmount,
                discountAmount: checkout.discountAmount,
                discountedSubtotal: checkout.discountedSubtotal,
                membershipDeliverySavings: checkout.membershipDeliverySavings,
                membershipSavings: checkout.membershipSavings,
                deliveryDiscountAmount: checkout.deliveryDiscountAmount,
                deliveryFee: checkout.deliveryFee,
                total: checkout.total,
                promoCode: checkout.appliedPromo?.code || "",
                selectedOffer: checkout.selectedOffer,
                membership: {
                    planName: checkout.membership?.planName || null,
                    isPriorityOrder: checkout.membership?.planName === "Premium" && Boolean(checkout.membership?.membershipId)
                },
                currency: "USD"
            }
        });
    } catch (error) {
        console.error("Checkout Summary Error:", error.message);

        const knownErrors = [
            "Your cart is empty.",
            "Your cart contains an invalid quantity.",
            "Some food items in your cart are no longer available.",
            "Invalid promo code.",
            "This promo code is inactive.",
            "This promo code has expired.",
            "This promo code usage limit has been reached.",
            "Selected promo offer is unavailable.",
            "Invalid promo offer selection.",
            "Invalid promo code discount type.",
            "Invalid final payment amount.",
            "Promo percentage cannot exceed 100."
        ];

        const clientError = knownErrors.includes(error.message) || isCheckoutCartError(error) || error.message.startsWith("Minimum order amount for this promo is") || error.message.startsWith("Invalid promo discount") || error.message.startsWith("Invalid maximum promo discount");

        return res.status(clientError ? 400 : 500).json({
            success: false,
            message: clientError ? error.message : "Unable to calculate checkout pricing."
        });
    }
};

// Create pending Stripe or COD order
const createPendingOrder = async ({ userId, formData, deliveryLocation, paymentMethod, checkout }) => {
    if(!validateAddress(formData)){
        throw new Error("Please provide complete delivery information.");
    }

    if(!validateDeliveryLocation(deliveryLocation)){
        throw new Error("Please select a valid delivery location on the map.");
    }

    const { selectedBranch } = await selectBestBranch(deliveryLocation);

    return orderModel.create({
        userId,
        branchId: selectedBranch.branchId,
        deliveryDistanceKm: selectedBranch.distanceKm,

        items: checkout.items,
        subtotal: checkout.subtotal,
        amount: checkout.discountedSubtotal,

        promoCode: checkout.appliedPromo?.code || "",

        discountAmount: checkout.discountAmount,

        membershipId: checkout.membership?.membershipId ?? null,

        isPriorityOrder: checkout.membership?.planName === "Premium" && Boolean(checkout.membership?.membershipId),

        membershipFoodDiscount: checkout.membershipFoodDiscount,

        membershipDeliverySavings: checkout.membershipDeliverySavings,

        membershipSavings: checkout.membershipSavings,

        promoDiscountAmount: checkout.promoDiscountAmount,

        selectedOffer: checkout.selectedOffer,

        deliveryDiscountAmount: checkout.deliveryDiscountAmount,

        deliveryFee: checkout.deliveryFee,

        address: {
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            email: formData.email.trim(),
            street: formData.street.trim(),
            city: formData.city.trim(),
            state: formData.state.trim(),
            zipCode: formData.zipCode.trim(),
            country: formData.country.trim(),
            phone: formData.phone.trim()
        },

        deliveryLocation: {
            latitude: deliveryLocation.latitude,
            longitude: deliveryLocation.longitude
        },

        paymentStatus: "Pending",
        paymentMethod,
        orderStatus: "Pending"
    });
};

// Increment promo usage
const incrementPromoUsage = async (promoId) => {
    if(!promoId){
        return;
    }

    const promo = await promoCodeModel.findByIdAndUpdate(
        promoId,
        {
            $inc: {
                usedCount: 1
            }
        },
        {
            returnDocument: "after"
        }
    );

    if(promo && promo.usageLimit !== null && promo.usageLimit !== undefined && promo.usedCount >= promo.usageLimit){
        promo.isActive = false;
        await promo.save();
    }
};

// Send customer receipt
const sendReceiptEmail = async (order) => {
    const receiptEmail = generateReceiptEmail(order);

    await transporter.sendMail({
        from: `"QuickTaste" <${process.env.EMAIL_USER}>`,
        to: order.address.email,
        subject: receiptEmail.subject || `QuickTaste Order Receipt - ${order._id}`,
        text: receiptEmail.text,
        html: receiptEmail.html
    });
};

// Atomically complete a verified Stripe payment
const completeOrder = async (order, promoId = null, paymentIntentId = "") => {
    const updatedOrder = await orderModel.findOneAndUpdate(
        {
            _id: order._id,
            paymentMethod: "Stripe",
            paymentStatus: "Pending",
            orderStatus: "Pending",
            refundStatus: {
                $nin: [
                    "Processing",
                    "Refunded",
                    "Failed"
                ]
            }
        },
        {
            $set: {
                paymentStatus: "Paid",
                orderStatus: "Pending",
                preparationStartedAt: null,
                ...(paymentIntentId ? {stripePaymentIntentId: paymentIntentId} : {})
            }
        },
        {
            returnDocument: "after"
        }
    );

    // Prevent duplicate payment processing
    if(!updatedOrder){
        console.log(`Duplicate or ineligible Stripe completion skipped: ${order._id}`);
        return null;
    }

    // Record membership savings once
    try {
        if(updatedOrder.membershipId && updatedOrder.paymentMethod === "Stripe"){
            const savingsResult = await recordMembershipSavings(updatedOrder._id);

            if(savingsResult.counted){
                console.log(`Membership savings recorded: $${savingsResult.savings.toFixed(2)}`);
            }
        }
    } catch (error) {
        console.error("Membership savings tracking error:", error.message);
    }

    // Clear customer cart
    try {
        await userModel.findByIdAndUpdate(
            updatedOrder.userId,
            {
                cartData: {},
                customizedCartData: []
            }
        );
    } catch (error) {
        console.error("Clear cart error:", error.message);
    }

    // Send payment receipt
    try {
        await sendReceiptEmail(updatedOrder);

        console.log("Payment receipt email sent successfully.");
    } catch (error) {
        console.error("Receipt email error:", error.message);
    }

    // Increment promo usage once
    try {
        await incrementPromoUsage(promoId);
    } catch (error) {
        console.error("Promo usage update error:", error.message);
    }

    return updatedOrder;
}

// Create Stripe Checkout Session
export const createStripeSession = async (req, res) => {
    let order;

    try {
        const userId = req.userId;

        const { formData, promoCode, selectedOffer = 1, deliveryLocation } = req.body;

        if(!userId){
            return res.status(401).json({
                success: false,
                message: "Please log in again."
            });
        }

        if(!validateAddress(formData)){
            return res.status(400).json({
                success: false,
                message: "Please provide complete delivery information."
            });
        }

        const user = await userModel.findById(userId);

        if(!user){
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const checkout = await getCheckoutDetails(user, promoCode, selectedOffer);

        const stripe = getStripe();

        order = await createPendingOrder({
            userId,
            formData,
            deliveryLocation,
            paymentMethod: "Stripe",
            checkout
        });

        const orderId = order._id.toString();

        const amountInCents = Math.round(checkout.total * 100);

        const session = await stripe.checkout.sessions.create({
            mode: "payment",
            
            line_items: [
                {
                    price_data: {
                        currency: "usd",
                        product_data: {
                            name: `QuickTaste Food Order ${orderId}`
                        },
                        unit_amount: amountInCents
                    },
                    quantity: 1
                }
            ],

            client_reference_id: orderId,

            metadata: {
                orderId,
                userId: userId.toString()
            },

            success_url: `${FRONTEND_URL}/payment-success?order_id=${orderId}&session_id={CHECKOUT_SESSION_ID}`,

            cancel_url: `${FRONTEND_URL}/order?payment=cancelled&order_id=${orderId}`
        });

        // Save Stripe Checkout Session ID
        order.stripeSessionId = session.id;

        await order.save();

        return res.status(200).json({
            success: true,
            checkoutUrl: session.url,
            orderId,
            summary: {
                subtotal: checkout.subtotal,
                discountAmount: checkout.discountAmount,
                deliveryDiscountAmount: checkout.deliveryDiscountAmount,
                deliveryFee: checkout.deliveryFee,
                total: checkout.total,
                promoCode: checkout.appliedPromo?.code || "",
                currency: "USD"
            }
        });

    } catch (error) {
        console.error("Stripe Create Session Error:", error.message);

        // Clean up only unpaid orders without a session
        if(order?._id){
            try {
                await orderModel.findOneAndDelete({
                    _id: order._id,
                    paymentStatus: "Pending",
                    stripeSessionId: {
                        $exists: false
                    }
                });
            } catch (deleteError) {
                console.error("Pending order cleanup error:", deleteError.message);
            }
        }

        const clientErrors = [
            "Your cart is empty.",
            "Your cart contains an invalid quantity.",
            "Some food items in your cart are no longer available.",
            "Please provide complete delivery information.",
            "Invalid promo code.",
            "This promo code is inactive.",
            "This promo code has expired.",
            "This promo code usage limit has been reached.",
            "Invalid promo code discount type.",
            "Selected promo offer is unavailable.",
            "Invalid promo offer selection.",
            "Invalid final payment amount.",
            "Please select a valid delivery location on the map.",
            "Invalid customer delivery location.",
            "No operational branches available.",
            "No branches have valid routing locations.",
            "Delivery is not available at this location."
        ];

        const isClientError = clientErrors.includes(error.message) || isCheckoutCartError(error) || error.message.startsWith("Minimum order amount for this promo is");

        return res.status(isClientError ? 400 : 500).json({
            success: false,
            message: error.message || "Unable to start Stripe payment."
        });
    }
};

// Create Cash on Delivery Order
export const createCodOrder = async (req, res) => {
    try {
        const userId = req.userId;

        const { formData, promoCode, selectedOffer = 1, deliveryLocation } = req.body;

        if(!userId){
            return res.status(401).json({
                success: false,
                message: "Please log in again."
            });
        }

        if(!validateAddress(formData)){
            return res.status(400).json({
                success: false,
                message: "Please provide complete delivery information."
            });
        }

        const user = await userModel.findById(userId);

        if(!user){
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const checkout = await getCheckoutDetails(
            user,
            promoCode,
            selectedOffer
        );

        const order = await createPendingOrder({
            userId,
            formData,
            deliveryLocation,
            paymentMethod: "Cash on Delivery",
            checkout
        });

        // Count promo usage after COD order creation
        try {
            if(checkout.appliedPromo){
                await incrementPromoUsage(
                    checkout.appliedPromo._id
                );
            }
        } catch (promoError) {
            console.error("COD promo usage update error:", promoError.message);
        }

        // Clear customer cart
        await userModel.findByIdAndUpdate(
            userId,
            {
                cartData: {},
                customizedCartData: []
            }
        );

        // Send COD confirmation email
        try {
            await sendReceiptEmail(order);

            console.log("COD order confirmation email sent.")
        } catch (emailError) {
            console.error("COD confirmation email error:", emailError.message);
        }

        return res.status(201).json({
            success: true,
            message: "Your order has been placed successfully.",
            orderId: order._id,
            paymentMethod: "Cash on Delivery",
            paymentStatus: "Pending",
            summary: {
                subtotal: checkout.subtotal,
                discountAmount: checkout.discountAmount,
                deliveryDiscountAmount: checkout.deliveryDiscountAmount,
                deliveryFee: checkout.deliveryFee,
                total: checkout.total,
                promoCode: checkout.appliedPromo?.code || "",
                currency: "USD"
            }
        });

    } catch (error) {
        console.error("COD Order Creation Error:", error.message);

        const clientErrors = [
            "Your cart is empty.",
            "Your cart contains an invalid quantity.",
            "Some food items in your cart are no longer available.",
            "Please provide complete delivery information.",
            "Invalid promo code.",
            "This promo code is inactive.",
            "This promo code has expired.",
            "This promo code usage limit has been reached.",
            "Invalid promo code discount type.",
            "Selected promo offer is unavailable.",
            "Invalid promo offer selection.",
            "Invalid final payment amount.",
            "Please select a valid delivery location on the map.",
            "Invalid customer delivery location.",
            "No operational branches available.",
            "No branches have valid routing locations.",
            "Delivery is not available at this location."
        ];

        const isClientError = clientErrors.includes(error.message) || isCheckoutCartError(error) || error.message.startsWith("Minimum order amount for this promo is");

        return res.status(isClientError ? 400 : 500).json({
            success: false,
            message: isClientError ? error.message : "Unable to place your order. Please try again."
        });
    }
};

// Stripe Webhook Handler
export const stripeWebhook = async (req, res) => {
    let event;

    try {
        const stripe = getStripe();

        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

        if(!webhookSecret){
            return res.status(500).send(
                "Webhook configuration error."
            );
        }

        const signature = req.headers["stripe-signature"];

        if(!signature){
            return res.status(400).send(
                "Missing Stripe signature."
            );
        }

        event = stripe.webhooks.constructEvent(
            req.body,
            signature,
            webhookSecret
        );
    } catch (error) {
        console.error( "Stripe Webhook Signature Error:", error.message);

        return res.status(400).send(
            "Invalid Stripe webhook signature."
        );
    }

    try {
        // Refund webhook
        if(event.type === "refund.updated"){
            const refundObject = event.data.object;

            const refundId = refundObject?.id;

            const orderId = refundObject?.metadata?.orderId;

            if(!orderId){
                return res.status(200).json({
                    received: true,
                    message: "Non-food refund event ignored."
                });
            }

            if(!refundId){
                return res.status(400).send(
                    "Missing refund ID."
                );
            }

            const result = await reconcileStripeRefund(refundId);

            return res.status(200).json({
                received: true,
                refundReconciled: result.reconciled,
                refundStatus: result.refundStatus
            });
        }

        // Ignore unrelated Stripe events
        if(event.type !== "checkout.session.completed"){
            return res.status(200).json({
                received: true
            });
        }

        const session = event.data.object;

        if(session.payment_status !== "paid"){
            return res.status(200).json({
                received: true,
                message: "Payment is not marked as paid."
            });
        }

        // Membership payments use separate handling
        if(session.mode === "subscription" || session.metadata?.paymentType === "membership"){
            return res.status(200).json({
                received: true,
                message: "Membership event ignored by food payment webhook."
            });
        }

        const orderId = session.metadata?.orderId;

        if(!orderId){
            return res.status(400).send(
                "Missing order ID."
            );
        }

        const order = await orderModel.findById(orderId);

        if(!order){
            return res.status(404).send(
                "Order not found."
            );
        }

        if(order.paymentMethod !== "Stripe"){
            return res.status(400).send(
                "Invalid payment method."
            );
        }

        // Prevent refunded or cancelled orders from being processed again
        if(order.paymentStatus !== "Pending" || order.orderStatus !== "Pending" || ["Processing", "Refunded", "Failed"].includes(order.refundStatus)){
            return res.status(200).json({
                received: true,
                message: "Order already processed or not eligible for completion."
            });
        }

        if(!order.stripeSessionId || order.stripeSessionId !== session.id){
            return res.status(400).send(
                "Stripe session mismatch."
            );
        }

        if(session.client_reference_id !== orderId || session.metadata?.userId !== order.userId.toString()){
            return res.status(400).send(
                "Stripe order reference mismatch."
            );
        }

        const expectedAmount = Math.round((Number(order.amount) + Number(order.deliveryFee)) * 100);

        if(session.mode !== "payment" || session.currency !== "usd" || session.amount_total !== expectedAmount){
            return res.status(400).send(
                "Payment amount or currency mismatch."
            );
        }

        let promoId = null;

        if(order.promoCode){
            const promo = await promoCodeModel.findOne({ code: order.promoCode });

            if(promo){
                promoId = promo._id;
            }
        }

        const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || "";

        const completedOrder = await completeOrder(order, promoId, paymentIntentId);

        if(!completedOrder){
            return res.status(200).json({
                received: true,
                message: "Duplicate or ineligible payment completion ignored."
            });
        }

        console.log(`Stripe payment verified for order ${order._id}`);

        return res.status(200).json({
            received: true,
            success: true
        });

    } catch (error) {
        console.error("Stripe Webhook Processing Error:", error.message);

        return res.status(500).send(
            "Unable to process Stripe webhook."
        );
    }
};

// Verify Stripe Payment
export const verifyStripePayment = async (req, res) => {
    try {
        const userId = req.userId;

        const { sessionId } = req.body;

        if(!userId){
            return res.status(401).json({
                success: false,
                message: "Please log in again."
            });
        }

        if(!sessionId){
            return res.status(400).json({
                success: false,
                message: "Stripe session ID is required."
            });
        }

        const stripe = getStripe();

        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if(session.payment_status !== "paid" || session.mode !== "payment"){
            return res.status(400).json({
                success: false,
                message: "Payment has not been completed."
            });
        }

        const orderId = session.metadata?.orderId;

        if(!orderId){
            return res.status(400).json({
                success: false,
                message: "Order reference is missing."
            });
        }

        const order = await orderModel.findById(orderId);

        if(!order){
            return res.status(404).json({
                success: false,
                message: "Order not found."
            });
        }

        if(order.userId.toString() !== userId.toString() || session.metadata?.userId !== userId.toString()){
            return res.status(403).json({
                success: false,
                message: "You are not authorized to verify this order."
            });
        }

        if(order.paymentMethod !== "Stripe" || order.stripeSessionId !== session.id || session.client_reference_id !== order._id.toString()){
            return res.status(400).json({
                success: false,
                message: "Stripe session does not match this order."
            });
        }

        const expectedAmount = Math.round((Number(order.amount) + Number(order.deliveryFee)) * 100);

        if(session.currency !== "usd" || session.amount_total !== expectedAmount){
            return res.status(400).json({
                success: false,
                message: "Payment amount verification failed."
            });
        }

        // Protect cancelled and refunded orders
        if(order.orderStatus === "Cancelled" || ["Processing", "Refunded", "Failed"].includes(order.refundStatus)){
            return res.status(409).json({
                success: false,
                message: "This order is cancelled or refund-protected."
            });
        }

        if(!["Pending", "Paid"].includes(order.paymentStatus)){
            return res.status(409).json({
                success: false,
                message: "This payment cannot be processed again."
            });
        }

        if(order.paymentStatus === "Pending"){
            const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || "";

            let promoId = null;

            if(order.promoCode){
                const promo = await promoCodeModel.findOne({ code: order.promoCode });

                if(promo){
                    promoId = promo._id;
                }
            }

            const completedOrder = await completeOrder(order, promoId, paymentIntentId);

            if(!completedOrder){
                // Webhook might have already completed it
                const currentOrder = await orderModel.findById(order._id);

                if(currentOrder?.paymentStatus !== "Paid" || currentOrder?.orderStatus === "Cancelled" || ["Processing", "Refunded", "Failed"].includes(currentOrder?.refundStatus)){
                    return res.status(409).json({
                        success: false,
                        message: "Order cannot be completed again."
                    });
                }
            }
        }

        return res.status(200).json({
            success: true,
            message: "Payment verified successfully.",
            orderId: order._id
        });

    } catch (error) {
        console.error("Stripe Payment Verification Error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to verify Stripe payment."
        });
    }
};