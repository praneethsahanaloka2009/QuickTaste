import crypto from "node:crypto";
import mongoose from "mongoose";
import orderModel from "../models/orderModel.js";
import emailTransporter from "../utils/emailTransporter.js";

const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;
const OTP_RESEND_INTERVAL_MS = 60 * 1000;

// Generate secure six-digit OTP
const generateOtp = () => crypto.randomInt(100000, 1000000).toString();

// Hash OTP with a server-side secret
const hashOtp = (orderId, otp) => {
    const secret = process.env.DELIVERY_OTP_SECRET;

    if(!secret){
        throw new Error("DELIVERY_OTP_SECRET is missing.");
    }

    return crypto.createHmac("sha256", secret).update(`${orderId}:${otp}`).digest("hex");
};

// Escape dynamic content before inserting it into HTML.
const escapeHtml = (value) => {
    return String(value ?? "").replace(
        /[&<>"']/g,
        (character) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]
    );
};

// Professional QuickTaste Delivery OTP Email Template
const generateDeliveryOtpEmail = ({ customerName, otp, orderId, expiryMinutes }) => {

    const safeName = escapeHtml(customerName);
    const safeOtp = escapeHtml(otp);
    const safeOrderId = escapeHtml(orderId);

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>QuickTaste Delivery Verification</title>
    </head>

    <body style="margin: 0; padding: 0; background-color: #f3f6f4; font-family: Arial, Helvetica, sans-serif; color: #1d2921;">

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f3f6f4;">
            <tr>
                <td align="center" style="padding: 40px 16px;">

                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 560px; background-color: #ffffff; border: 1px solid #e4ebe6; border-radius: 16px;">

                        <!-- HEADER -->
                        <tr>
                            <td align="center" style="background-color: #065d23; padding: 35px 24px; border-radius: 16px 16px 0 0;">

                                <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 800; letter-spacing: -1px;">
                                    QuickTaste
                                </h1>

                                <p style="margin: 10px 0 0; color: #d7f4df; font-size: 11px; font-weight: 600; letter-spacing: 2px;">
                                    DELIVERY VERIFICATION
                                </p>

                            </td>
                        </tr>

                        <!-- CONTENT -->
                        <tr>
                            <td style="padding: 36px 30px;">

                                <h2 style=" margin: 0 0 18px; color: #17251b; font-size: 24px; font-weight: 700;">
                                    Verify Your Delivery
                                </h2>

                                <p style="margin: 0 0 14px; color: #35433a;font-size: 15px; line-height: 1.8;">
                                    Hello <strong>${safeName}</strong>,
                                </p>

                                <p style="margin: 0 0 25px; color: #647168; font-size: 14px; line-height: 1.8;">
                                    Your QuickTaste order is on its way! Please use the verification code below to confirm your delivery with your assigned rider.
                                </p>

                                <!-- OTP BOX -->
                                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style=" background-color: #eff8f1; border: 1px solid #cce8d3; border-radius: 12px;">
                                    <tr>
                                        <td align="center" style="padding: 28px 12px;" >

                                            <p style="margin: 0 0 15px; color: #477454; font-size: 11px; font-weight: 700; letter-spacing: 2px;">
                                                YOUR VERIFICATION CODE
                                            </p>

                                            <div style="color: #065d23; font-size: 38px; font-weight: 800; letter-spacing: 7px; line-height: 1.3;">
                                                ${safeOtp}
                                            </div>

                                            <p style="margin: 16px 0 0; color: #65766a; font-size: 13px;">
                                                Expires in ${expiryMinutes} minutes
                                            </p>

                                        </td>
                                    </tr>
                                </table>

                                <!-- ORDER INFORMATION -->
                                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 28px; border-bottom: 1px solid #e8ede9;">
                                    <tr>
                                        <td style="padding: 14px 0; color: #78857b; font-size: 13px;">
                                            Order ID
                                        </td>

                                        <td align="right" style="padding: 14px 0; color: #25342a; font-size: 12px; font-weight: 700; overflow-wrap: anywhere;">
                                            ${safeOrderId}
                                        </td>
                                    </tr>
                                </table>

                                <!-- SECURITY NOTICE -->
                                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 26px; background-color: #fff8eb; border: 1px solid #f4e6c9; border-radius: 10px;">
                                    <tr>
                                        <td style="padding: 18px;">

                                            <p style="margin: 0 0 8px; color: #9a641c; font-size: 13px; font-weight: 700;">
                                                Security Reminder
                                            </p>

                                            <p style="margin: 0; color: #886c46; font-size: 12px; line-height: 1.8;">
                                                Share this OTP only with your assigned QuickTaste rider when receiving your order. Never share it with anyone else.
                                            </p>

                                        </td>
                                    </tr>
                                </table>

                                <p style="margin: 30px 0 0; color: #647168; font-size: 13px; line-height: 1.8;">
                                    Thank you for choosing QuickTaste!
                                </p>

                                <p style="margin: 12px 0 0; color: #065d23; font-size: 14px; font-weight: 700;">
                                    QuickTaste Team
                                </p>

                            </td>
                        </tr>

                        <!-- FOOTER -->
                        <tr>
                            <td align="center" style="padding: 24px 20px; background-color: #f8faf8; border-top: 1px solid #e8ede9; border-radius: 0 0 16px 16px;">

                                <p style="margin: 0 0 8px; color: #065d23; font-size: 15px; font-weight: 700;">
                                    QuickTaste
                                </p>

                                <p style="margin: 0; color: #9aa59d; font-size: 11px; line-height: 1.7;">
                                    Fast, Fresh & Delicious <br> &copy; ${new Date().getFullYear()} QuickTaste. All rights reserved.
                                </p>

                            </td>
                        </tr>

                    </table>

                </td>
            </tr>
        </table>

    </body>
    </html>
    `;
};

// STEP 1: Customer requests delivery OTP
const sendDeliveryOtp = async (req, res) => {
    try {
        const { id } = req.params;

        if(!mongoose.isValidObjectId(id)){
            return res.status(400).json({
                success: false,
                message: "Invalid order ID."
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

        if(!order.assignedRider){
            return res.status(400).json({
                success: false,
                message: "No rider has been assigned."
            });
        }

        if(order.deliveryOtpVerifiedAt){
            return res.status(409).json({
                success: false,
                message: "Delivery OTP already verified."
            });
        }

        const now = new Date();

        if(order.deliveryOtpSentAt && now.getTime() - new Date(order.deliveryOtpSentAt).getTime() < OTP_RESEND_INTERVAL_MS){
            return res.status(429).json({
                success: false,
                message: "Please wait 60 seconds before requesting another OTP."
            });
        }

        const otp = generateOtp();

        // Reserve this OTP request before sending the email.
        // This prevents simultaneous requests from bypassing cooldown.
        const reservedOrder = await orderModel.findOneAndUpdate(
            {
                _id: order._id,
                userId: req.userId,
                orderStatus: "Out for Delivery",
                deliveryOtpVerifiedAt: null,
                $or: [
                    {
                        deliveryOtpSentAt: null
                    },
                    {
                        deliveryOtpSentAt: {
                            $lte: new Date(now.getTime() - OTP_RESEND_INTERVAL_MS)
                        }
                    }
                ]
            },
            {
                $set: {
                    deliveryOtpHash: hashOtp(
                        order._id.toString(),
                        otp
                    ),
                    deliveryOtpExpiresAt: new Date(
                        now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000
                    ),
                    deliveryOtpAttempts: 0,
                    deliveryOtpSentAt: now
                }
            },
            {
                returnDocument: "after"
            }
        );

        if(!reservedOrder){
            return res.status(429).json({
                success: false,
                message: "OTP already requested or delivery status changed."
            });
        }

        const customerName = order.address.firstName || "Customer";

        const subject = "QuickTaste - Delivery Verification OTP";

        const message = `Hello ${customerName},\n\n` + `Your QuickTaste delivery verification OTP is: ${otp}\n\n` + `Order ID: ${order._id}\n` + `This OTP expires in ${OTP_EXPIRY_MINUTES} minutes.\n\n` + `Share this OTP only with your assigned QuickTaste rider ` + `when receiving your order.\n\n` + `QuickTaste Team`;

        const htmlMessage = generateDeliveryOtpEmail({customerName, otp, orderId: order._id.toString(), expiryMinutes: OTP_EXPIRY_MINUTES});

        try {
            await emailTransporter.sendMail({
                from: `"QuickTaste" <${process.env.EMAIL_USER}>`,
                to: order.address.email,
                subject,
                text: message,
                html: htmlMessage
            });
        } catch (emailError) {
            console.error("Delivery OTP Email Error:", emailError);

            // Do not return an OTP that may not have been sent.
            return res.status(502).json({
                success: false,
                message: "Unable to send delivery OTP email. Please retry later."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Delivery OTP sent to your email.",
            expiresInMinutes: OTP_EXPIRY_MINUTES
        });
        
    } catch (error) {
        console.error("Send Delivery OTP Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to request delivery OTP."
        });
    }
};

// STEP 2: Assigned rider verifies customer OTP
const verifyDeliveryOtp = async (req, res) => {
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
            assignedRider: req.riderId,
            orderStatus: "Out for Delivery"
        }).select("+deliveryOtpHash");

        if(!order){
            return res.status(404).json({
                success: false,
                message: "Eligible assigned order not found."
            });
        }

        if(order.deliveryOtpVerifiedAt){
            return res.status(409).json({
                success: false,
                message: "Delivery OTP already verified."
            });
        }

        if(!order.deliveryOtpHash ||  !order.deliveryOtpExpiresAt){
            return res.status(400).json({
                success: false,
                message: "Customer must request a delivery OTP first."
            });
        }

        if(Date.now() > new Date(order.deliveryOtpExpiresAt).getTime()){
            return res.status(400).json({
                success: false,
                message: "Delivery OTP has expired."
            });
        }

        if(order.deliveryOtpAttempts >= MAX_OTP_ATTEMPTS){
            return res.status(429).json({
                success: false,
                message: "Too many incorrect attempts. Request a new OTP."
            });
        }

        const submittedHash = hashOtp(order._id.toString(), otp);

        const submittedBuffer = Buffer.from(submittedHash, "hex");

        const storedBuffer = Buffer.from(order.deliveryOtpHash, "hex");

        const isMatch = submittedBuffer.length === storedBuffer.length && crypto.timingSafeEqual(submittedBuffer, storedBuffer);

        if(!isMatch){
            // Atomically increment failed attempts.
            const attemptResult = await orderModel.updateOne(
                {
                    _id: order._id,
                    assignedRider: req.riderId,
                    orderStatus: "Out for Delivery",
                    deliveryOtpHash: order.deliveryOtpHash,
                    deliveryOtpVerifiedAt: null,
                    deliveryOtpExpiresAt: {
                        $gt: new Date()
                    },
                    deliveryOtpAttempts: {
                        $lt: MAX_OTP_ATTEMPTS
                    }
                },
                {
                    $inc: {
                        deliveryOtpAttempts: 1
                    }
                }
            );

            if(attemptResult.modifiedCount === 0){
                return res.status(409).json({
                    success: false,
                    message: "OTP expired, attempt limit reached, or already verified."
                });
            }

            return res.status(400).json({
                success: false,
                message: "Incorrect delivery OTP."
            });
        }

        // Atomically verify, with expiry and attempt checks.
        const verifiedOrder = await orderModel.findOneAndUpdate(
            {
                _id: order._id,
                assignedRider: req.riderId,
                orderStatus: "Out for Delivery",
                deliveryOtpHash: submittedHash,
                deliveryOtpVerifiedAt: null,
                deliveryOtpExpiresAt: {
                    $gt: new Date()
                },
                deliveryOtpAttempts: {
                    $lt: MAX_OTP_ATTEMPTS
                }
            },
            {
                $set: {
                    deliveryOtpVerifiedAt: new Date()
                },
                $unset: {
                    deliveryOtpHash: ""
                }
            },
            {
                returnDocument: "after"
            }
        );

        if(!verifiedOrder){
            return res.status(409).json({
                success: false,
                message: "OTP expired, attempt limit reached, or already verified."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Customer delivery OTP verified successfully.",
            deliveryOtpVerifiedAt: verifiedOrder.deliveryOtpVerifiedAt
        });

    } catch (error) {
        console.error("Verify Delivery OTP Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to verify delivery OTP."
        });
    }
};

export {sendDeliveryOtp, verifyDeliveryOtp};