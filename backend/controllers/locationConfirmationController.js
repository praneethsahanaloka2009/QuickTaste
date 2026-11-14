import crypto from "node:crypto";
import mongoose from "mongoose";
import orderModel from "../models/orderModel.js";
import emailTransporter from "../utils/emailTransporter.js";
import generateLocationConfirmationEmail from "../utils/locationConfirmationEmail.js";

const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;
const OTP_RESEND_INTERVAL_MS = 60 * 1000;

// Hash OTP without storing the original code.
const hashOtp = (otp) => {
    return crypto.createHash("sha256").update(otp).digest("hex");
};

// Generate a secure 6-digit OTP.
const generateOtp = () => {
    return crypto.randomInt(100000, 1000000).toString();
};

// Validate latitude and longitude.
const isValidLocation = (latitude, longitude) => {
    return(
        typeof latitude === "number" && typeof longitude === "number" && Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
    );
};

// STEP 1: Send Location Confirmation OTP
const sendLocationOtp = async (req, res) => {
    try {
        const { id } = req.params;

        if(!mongoose.isValidObjectId(id)){
            return res.status(400).json({
                success: false,
                message: "Invalid order ID."
            });
        }

        // Only the logged-in customer can request OTP.
        const order = await orderModel.findOne({_id: id, userId: req.userId, orderStatus: "Out for Delivery"}).select("+locationOtpHash");

        if(!order){
            return res.status(404).json({
                success: false,
                message: "Eligible order not found."
            });
        }

        // Prevent excessive OTP requests.
        if(order.locationOtpSentAt && Date.now() - new Date(order.locationOtpSentAt).getTime() < OTP_RESEND_INTERVAL_MS){
            return res.status(429).json({
                success: false,
                message: "Please wait 60 seconds before requesting another OTP."
            });
        }

        // Prevent requesting another OTP while a location change is waiting for admin approval.
        if(order.locationChangeStatus === "Pending"){
            return res.status(409).json({
                success: false,
                message: "Your location change is awaiting admin approval."
            })
        }

        const otp = generateOtp();
        const now = new Date();

        order.locationOtpHash = hashOtp(otp);
        order.locationOtpExpiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);
        order.locationOtpAttempts = 0;
        order.locationOtpSentAt = now;
        order.locationOtpVerifiedAt = null;

        await order.save();

        const customerName = order.address.firstName || "Customer";

        const locationEmail = generateLocationConfirmationEmail({
            customerName,
            orderId: order._id.toString(),
            otp,
            expiryMinutes: OTP_EXPIRY_MINUTES
        });

        await emailTransporter.sendMail({
            from: `"QuickTaste" <${process.env.EMAIL_USER}>`,
            to: order.address.email,
            subject: locationEmail.subject,
            text: locationEmail.text,
            html: locationEmail.html
        });

        return res.status(200).json({
            success: true,
            message: "Location confirmation OTP sent to your email."
        });
        
    } catch (error) {
        console.error("Send Location OTP Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to send location OTP."
        });
    }
};

// STEP 2: Verify Location OTP
const verifyLocationOtp = async (req, res) => {
    try {
        const { id } = req.params;
        const { otp } = req.body;

        if(!mongoose.isValidObjectId(id)){
            return res.status(400).json({
                success: false,
                message: "Invalid order ID."
            });
        }

        if(typeof otp !== "string" || !/^\d{6}$/.test(otp)){
            return res.status(400).json({
                success: false,
                message: "Enter a valid 6-digit OTP."
            });
        }

        const order = await orderModel.findOne({
            _id: id,
            userId: req.userId,
            orderStatus: "Out for Delivery"
        }).select("+locationOtpHash");

        if(!order){
            return res.status(404).json({
                success: false,
                message: "Eligible order not found."
            });
        }

        if(!order.locationOtpHash || !order.locationOtpExpiresAt){
            return res.status(400).json({
                success: false,
                message: "Please request a location OTP first."
            });
        }

        if(order.locationOtpVerifiedAt){
            return res.status(400).json({
                success: false,
                message: "Location OTP already verified."
            });
        }

        if(Date.now() > new Date(order.locationOtpExpiresAt).getTime()){
            return res.status(400).json({
                success: false,
                message: "Location OTP has expired."
            });
        }

        if(order.locationOtpAttempts >= MAX_OTP_ATTEMPTS){
            return res.status(429).json({
                success: false,
                message: "Too many incorrect attempts. Request a new OTP."
            });
        }

        const submittedHash = Buffer.from(hashOtp(otp), "hex");

        const storedHash = Buffer.from(order.locationOtpHash, "hex");

        const isMatch = submittedHash.length === storedHash.length && crypto.timingSafeEqual(submittedHash, storedHash);

        if(!isMatch){
            order.locationOtpAttempts += 1;
            await order.save();

            return res.status(400).json({
                success: false,
                message: "Incorrect location OTP."
            });
        }

        order.locationOtpVerifiedAt = new Date();
        order.locationOtpHash = undefined;

        await order.save();

        return res.status(200).json({
            success: true,
            message: "OTP verified. You can now confirm your location."
        });

    } catch (error) {
        console.error("Verify Location OTP Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to verify location OTP."
        });
    }
};

// STEP 3: Confirm Customer GPS Location
const confirmCustomerLocation = async (req, res) => {
    try {
        const { id } = req.params;
        const { latitude, longitude } = req.body;

        if(!mongoose.isValidObjectId(id)){
            return res.status(400).json({
                success: false,
                message: "Invalid order ID."
            });
        }

        if(!isValidLocation(latitude, longitude)){
            return res.status(400).json({
                success: false,
                message: "Invalid GPS coordinates."
            });
        }

        const order = await orderModel.findOne({
            _id: id,
            userId: req.userId,
            orderStatus: "Out for Delivery"
        });

        if(!order){
            return res.status(404).json({
                success: false,
                message: "Eligible order not found."
            });
        }

        if(!order.locationOtpVerifiedAt || !order.locationOtpExpiresAt){
            return res.status(403).json({
                success: false,
                message: "Please verify your location OTP first."
            });
        }

        // Location confirmation must be completed within 10 minutes of OTP verification.
        const verificationExpiry = Math.min(new Date(order.locationOtpVerifiedAt).getTime() + OTP_EXPIRY_MINUTES * 60 * 1000, new Date(order.locationOtpExpiresAt).getTime());

        if(Date.now() > verificationExpiry){
            return res.status(403).json({
                success: false,
                message: "Location confirmation session expired. Please request a new OTP."
            });
        }

        // Store the proposed location separately.
        // Do not overwrite the original delivery location.
        order.customerConfirmedLocation = {
            latitude,
            longitude,
            confirmedAt: new Date()
        };

        // Requires approval before being used for navigation.
        order.locationChangeStatus = "Pending";

        // Prevent reuse of this OTP verification.
        order.locationOtpVerifiedAt = null;
        order.locationOtpExpiresAt = null;

        await order.save();

        return res.status(200).json({
            success: true,
            message: "Location submitted. Awaiting admin approval.",
            locationChangeStatus: order.locationChangeStatus
        });

    } catch (error) {
        console.error("Confirm Customer Location Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to confirm customer location."
        });
    }
};

export { sendLocationOtp, verifyLocationOtp, confirmCustomerLocation };