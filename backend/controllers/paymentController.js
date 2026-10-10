import Stripe from "stripe";
import nodemailer from "nodemailer";

import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";
import foodModel from "../models/foodModel.js";
import promoCodeModel from "../models/promoCodeModel.js";
import generateReceiptEmail from "../utils/receiptEmail.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const DELIVERY_FEE = 2;

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// COMMON HELPERS

// Validate delivery information
const validateAddress = (formData) => {
    const requiredFields = ["firstName", "lastName", "email", "street", "city", "state", "zipCode", "country", "phone"];

    return (
        formData && requiredFields.every((field) => typeof formData[field] === "string" && formData[field].trim().length > 0)
    );
};

// Get cart items from database
const getCartItems = async (user) =>{
    if(!user.cartData || Object.keys(user.cartData).length === 0){
        throw new Error("Your cart is empty.");
    }

    const cartItems = Object.entries(user.cartData);

    const items = [];

    for(const [foodId, quantityValue] of cartItems){
        const quantity = Number(quantityValue);

        if(!Number.isInteger(quantity) || quantity <= 0){
            throw new Error("Your cart contains an invalid quantity.");
        }

        const food = await foodModel.findById(foodId);

        if(!food){
            throw new Error(
                "Some food items in your cart are no longer available."
            );
        }

        items.push({
            foodId: food._id,
            name: food.name,
            price: Number(food.price),
            quantity,
            preparationTime: Number(food.preparationTime) || 15
        });
    }

    if(items.length === 0){
        throw new Error("Your cart is empty.");
    }

    const subtotal = Number(
        items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)
    );

    return { items, subtotal };
};

// Validate promo code and calculate discount
const calculateDiscount = async(subtotal,promoCode) => {
    let discountAmount = 0;
    let appliedPromo = null;

    if(!promoCode || !promoCode.trim()){
        return { discountAmount, appliedPromo };
    }

    const normalizedCode = promoCode.trim().toUpperCase();

    const promo = await promoCodeModel.findOne({
        code: normalizedCode
    });

    if(!promo){
        throw new Error(
            "Invalid promo code."
        );
    }

    if(!promo.isActive) {
        throw new Error(
            "This promo code is inactive."
        );
    }

    if(!promo.expiryDate || new Date() > new Date(promo.expiryDate)){
        throw new Error(
            "This promo code has expired."
        );
    }

    if(promo.usageLimit !== null && promo.usageLimit !== undefined && promo.usedCount >= promo.usageLimit){
        throw new Error(
            "This promo code usage limit has been reached."
        )
    }

    if(subtotal < Number(promo.minOrderAmount || 0)){
        throw new Error(
            `Minimum order amount for this promo is $${Number(promo.minOrderAmount).toFixed(2)}.`
        );
    }

    if(promo.discountType === "percentage"){
        discountAmount = subtotal * (Number(promo.discountValue) / 100);
    } else {
        discountAmount = Number(promo.discountValue);
    }

    if(promo.maxDiscountAmount !== null && promo.maxDiscountAmount !== undefined && discountAmount > Number(promo.maxDiscountAmount)){
        discountAmount = Number(promo.maxDiscountAmount);
    }

    discountAmount = Math.min(discountAmount, subtotal);

    discountAmount = Number(discountAmount.toFixed(2));

    appliedPromo = promo;

    return { discountAmount, appliedPromo };
}

// Calculate complete checkout summary
const getCheckoutDetails = async (user, promoCode) => {
    
    const { items, subtotal } = await getCartItems(user);

    const { discountAmount, appliedPromo } = await calculateDiscount(subtotal, promoCode);

    const discountedSubtotal = Number(
        Math.max(0, subtotal - discountAmount).toFixed(2)
    )

    const total = Number(
        (discountedSubtotal + DELIVERY_FEE).toFixed(2)
    );

    if(total <= 0){
        throw new Error("Invalid final payment amount.");
    }

    return{
        items,
        subtotal,
        discountAmount,
        discountedSubtotal,
        deliveryFee: DELIVERY_FEE,
        total,
        appliedPromo
    };

};

// Save a pending order before redirecting to the payment gateway
const createPendingOrder = async({userId, formData, paymentMethod, checkout}) => {
    if(!validateAddress(formData)){
        throw new Error("Please provide complete delivery information.");
    }

    return orderModel.create({
        userId,
        items: checkout.items,

        // Store discounted subtotal separately from delivery fee
        amount: checkout.discountedSubtotal,
        deliveryFee: checkout.deliveryFee,

        address : {
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

        paymentStatus: "Pending",
        paymentMethod,
        orderStatus: "Pending"
    });
};

// Increment promo usage after successful payment
const incrementPromoUsage = async (promoId) => {
    if (!promoId) return;

    const promo = await promoCodeModel.findByIdAndUpdate(
        promoId,
        { $inc: { usedCount: 1 } },
        { returnDocument : 'after' }
    );

    if(promo && promo.usageLimit !== null && promo.usageLimit !== undefined && promo.usedCount >= promo.usageLimit){
        promo.isActive = false;
        await promo.save();
    }
};

// Send receipt email
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

// Complete a verified payment
const completeOrder = async (order, promoId = null) => {
    if(order.paymentStatus === "Paid"){
        return order;
    }

    order.paymentStatus = "Paid";
    order.orderStatus = "Pending";
    order.preparationStartedAt = null;

    await order.save();

    // Clear cart only after the payment is confirmed
    await userModel.findByIdAndUpdate(order.userId,{
        cartData: {}
    });

    // Email errors must not undo a successful payment
    try {
        await sendReceiptEmail(order);
        console.log("Payment receipt email sent successfully.");
    } catch (emailError) {
        console.error(
            "Receipt email error:",
            emailError.message
        );
    }

    // Update promo usage after successful payment
    try {
        await incrementPromoUsage(promoId);
    } catch (promoError) {
        console.log(
            "Promo usage update error:",
            promoError.message
        );
    }

    return order;
};

// Stripe: Create checkout session
export const createStripeSession = async (req, res) => {
    let order;

    try {
        const userId = req.userId;
        const { formData, promoCode } = req.body;

        if(!userId){
            return res.status(401).json({
                success: false,
                message: "Please log in again."
            })
        }

        const user = await userModel.findById(userId);

        if(!user){
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const checkout = await getCheckoutDetails(
            user, promoCode
        );

        order = await createPendingOrder({
            userId, formData, paymentMethod: "Stripe", checkout
        })

        const session = await stripe.checkout.sessions.create({
            mode: "payment",

            line_items : [
                {
                    price_data: {
                        currency: "usd",
                        product_data: {
                            name: "QuickTaste Food Order",
                            description: `Order ${order._id}`
                        },
                        unit_amount: Math.round(checkout.total * 100)
                    },
                    quantity: 1
                }
            ],

            metadata : {
                userId: userId.toString(),
                orderId: order._id.toString(),
                promoId: checkout.appliedPromo ? checkout.appliedPromo._id.toString() : ""
            },

            success_url: `${FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,

            cancel_url: `${FRONTEND_URL}/payment`
        });

        order.stripeSessionId = session.id;
        await order.save();

        return res.status(200).json({
            success: true,
            url: session.url,
            orderId: order._id,
            summary: {
                subtotal: checkout.subtotal,
                discountAmount: checkout.discountAmount,
                deliveryFee: checkout.deliveryFee,
                total: checkout.total,
                promoCode: checkout.appliedPromo ? checkout.appliedPromo.code : ""
            }
        });

    } catch (error) {
        console.error(
            "Stripe Payment Error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: error.message || "Unable to create Stripe payment session."
        });
    }
};

// Stripe: verify payment
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

        if(!sessionId) {
            return res.status(400).json({
                success: false,
                message: "Stripe session ID is required."
            });
        }

        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if(!session.metadata || session.metadata.userId !== userId.toString()){
            return res.status(403).json({
                success: false,
                message: "This payment session does not belong to you."
            });
        }

        const order = await orderModel.findOne({
            _id: session.metadata.orderId,
            userId,
            stripeSessionId: sessionId
        });

        if(!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found."
            });
        }

        if(order.paymentStatus === "Paid") {
            return res.status(200).json({
                success: true,
                message: "Payment was already verified.",
                order
            });
        }

        const expectedTotal = Math.round((Number(order.amount) + Number(order.deliveryFee)) * 100);

        if(session.payment_status !== "paid" || session.currency !== "usd" || session.amount_total !== expectedTotal){
            return res.status(400).json({
                success: false,
                message:
                    "Payment amount does not match the order amount."
            });
        }

        const completedOrder = await completeOrder(
            order,
            session.metadata.promoId || null
        );

        return res.status(200).json({
            success: true,
            message: "Stripe payment verified successfully.",
            order: completedOrder,
            session: {
                id: session.id,
                paymentStatus: session.payment_status,
                amountTotal: session.amount_total / 100,
                currency: session.currency
            }
        });
    } catch (error) {
        console.error(
            "Stripe Verification Error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to verify Stripe payment."
        });
    }
};
