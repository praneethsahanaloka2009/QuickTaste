import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import validator from "validator";
import mongoose from "mongoose";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import riderModel from "../models/riderModel.js";
import orderModel from "../models/orderModel.js";
import { OAuth2Client } from "google-auth-library";
import { randomBytes } from "crypto";
import { encryptBankAccount, decryptBankAccount } from "../utils/bankEncryption.js";

// Upload Configuration — Rider Avatars
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const riderUploadDir = path.resolve(__dirname, "../uploads/riders");

// Create the upload directory if it does not exist.
fs.mkdirSync(riderUploadDir, { recursive: true });

const riderStorage = multer.diskStorage({
    destination: (req,file,cb) => {
        cb(null, riderUploadDir);
    },

    filename: (req,file,cb) => {
        const extension = path.extname(file.originalname).toLowerCase();

        cb(null, `rider-${req.riderId}-${Date.now()}${extension}`);
    }
});

const uploadRiderAvatar = multer({
    storage: riderStorage,
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req,file,cb) => {
        const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

        if(allowedTypes.includes(file.mimetype)){
            return cb(null, true);
        }

        return cb(new Error("Only JPG, SVG, PNG and WebP images are allowed."));
    }
});

// Helper Functions
// Return safe rider information without the password.
const formatRider = (rider) => ({
    _id: rider._id,
    name: rider.name,
    email: rider.email,
    phone: rider.phone,
    vehicleType: rider.vehicleType,
    avatar: rider.avatar || "",
    isActive: rider.isActive,
    createdAt: rider.createdAt
});

// Delete only an avatar owned by this rider.
const deleteLocalRiderAvatar = async (avatar, riderId) => {
    try {
        if(!avatar || typeof avatar !== "string"){
            return;
        }

        const prefix = "/images/riders/";

        if(!avatar.startsWith(prefix)){
            return;
        }

        const filename = path.basename(avatar);
        const expectedPrefix = `rider-${riderId}-`;

        if(!filename.startsWith(expectedPrefix)){
            return;
        }

        const filePath = path.join(riderUploadDir, filename);

        await fs.promises.unlink(filePath).catch((error) => {
            if(error.code !== "ENOENT"){
                throw error;
            }
        });
    } catch (error) {
        console.error("Delete Rider Avatar Error:", error);
    }
};

// Normal Rider Register
const registerRider = async (req, res) => {
    try {
        const name = String(req.body.name || "").trim();
        const email = String(req.body.email || "").trim().toLowerCase();
        const phone = String(req.body.phone || "").trim();
        const password = req.body.password;

        const allowedVehicles = ["Motorcycle", "Bicycle", "Scooter", "Other"];

        const vehicleType = req.body.vehicleType || "Motorcycle";

        // Validate required fields
        if(!name || !email || !phone || !password){
            return res.status(400).json({
                success: false,
                message: "Name, email, phone and password are required."
            });
        }

        // Validate name
        if(name.length < 2 || name.length > 100){
            return res.status(400).json({
                success: false,
                message: "Name must contain between 2 and 100 characters."
            });
        }

        // Validate email
        if(!validator.isEmail(email)){
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email address."
            });
        }

        // Validate phone
        if(phone.length > 30){
            return res.status(400).json({
                success: false,
                message: "Please provide a valid phone number."
            });
        }

        // Validate password
        if(typeof password !== "string" || password.length < 8 || password.length > 128){
            return res.status(400).json({
                success: false,
                message: "Password must contain between 8 and 128 characters."
            });
        }

        // Validate vehicle type
        if(!allowedVehicles.includes(vehicleType)){
            return res.status(400).json({
                success: false,
                message: "Invalid vehicle type."
            });
        }

        // Prevent duplicate registration
        const existingRider = await riderModel.findOne({ email });

        if(existingRider){
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists."
            });
        }

        // Ensure Rider JWT is configured
        if(!process.env.RIDER_JWT_SECRET){
            console.error("RIDER_JWT_SECRET is missing.");

            return res.status(500).json({
                success: false,
                message: "Rider authentication is not configured."
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create Rider account
        const rider = await riderModel.create({
            name,
            email,
            phone,
            password: hashedPassword,
            vehicleType,
            isActive: true
        });

        // Generate Rider-only token
        const token = jwt.sign(
            {
                id: rider._id.toString(),
                role: "rider"
            },
            process.env.RIDER_JWT_SECRET,
            {
                expiresIn: "7d"
            }
        );

        return res.status(201).json({
            success: true,
            message: "Rider registered successfully.",
            token,
            rider: formatRider(rider)
        });

    } catch (error) {
        if(error.code === 11000){
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists."
            });
        }

        console.error("Normal Rider Register Error:", error);

        return res.status(500).json({
            success: false,
            message: "Rider registration failed."
        });
    }
}

// Normal Rider Login
const loginRider = async (req, res) => {
    try {
        const email = String(req.body.email || "").trim().toLowerCase();

        const password = req.body.password;

        if(!email || !password){
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        const rider = await riderModel.findOne({ email }).select("+password");

        if(!rider || !rider.isActive){
            return res.status(401).json({
                success: false,
                message: "Invalid credentials or inactive account."
            });
        }

        const matched = await bcrypt.compare(password, rider.password);

        if(!matched){
            return res.status(401).json({
                success: false,
                message: "Invalid credentials."
            });
        }

        if(!process.env.RIDER_JWT_SECRET){
            console.error("RIDER_JWT_SECRET is missing.");

            return res.status(500).json({
                success: false,
                message: "Rider authentication is not configured."
            });
        }

        const token = jwt.sign(
            {
                id: rider._id.toString(),
                role: "rider"
            },
            process.env.RIDER_JWT_SECRET,{expiresIn: "7d"}
        );

        return res.status(200).json({
            success: true,
            token,
            rider: formatRider(rider)
        });

    } catch (error) {
        console.error("Rider Login Error:", error);

        return res.status(500).json({
            success: false,
            message: "Rider login failed."
        });
    }
};

// Get Rider Profile
const getRiderProfile = async (req, res) => {
    try {
        return res.status(200).json({
            success: true,
            rider: formatRider(req.rider)
        });
    } catch (error) {
        console.error("Get Rider Profile Error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not load rider profile."
        });
    }
};

// Create Rider - Admin Only
const createRider = async (req, res) => {
    try {
        const name = String(req.body.name || "").trim();
        const email = String(req.body.email || "").trim().toLowerCase();

        const phone = String(req.body.phone || "").trim();
        const password = req.body.password;

        const allowedVehicles = ["Motorcycle", "Bicycle", "Scooter", "Other"];

        const vehicleType = req.body.vehicleType || "Motorcycle";

        if(!name || !email || !phone || !password){
            return res.status(400).json({
                success: false,
                message: "Name, email, phone and password are required."
            });
        }

        if(!validator.isEmail(email)){
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email address."
            });
        }

        if(typeof password !== "string" || password.length < 8){
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 8 characters."
            });
        }

        if(!allowedVehicles.includes(vehicleType)){
            return res.status(400).json({
                success: false,
                message: "Invalid vehicle type."
            });
        }

        const existingRider = await riderModel.findOne({ email });

        if(existingRider){
            return res.status(409).json({
                success: false,
                message: "A rider with this email already exists."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const rider = await riderModel.create({
            name,
            email,
            password : hashedPassword,
            phone,
            vehicleType,
            isActive : true
        });

        return res.status(201).json({
            success: true,
            message: "Rider created successfully.",
            rider: formatRider(rider)
        });
        
    } catch (error) {
        if(error.code === 11000){
            return res.status(409).json({
                success: false,
                message: "A rider with this email already exists."
            });
        }

        console.error("Create Rider Error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not create rider."
        });
    }
};

// Get All Riders - Admin Only
const getAllRiders = async (req, res) => {
    try {
        const riders = await riderModel.find({}).select("name email phone vehicleType avatar isActive createdAt").sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: riders.length,
            riders
        });
    } catch (error) {
        console.error("Get All Riders Error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not load riders."
        });
    }
};

// Assign Rider to Order — Admin Only
const assignRiderToOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const riderId = req.body.riderId;

        if(!mongoose.isValidObjectId(id)){
            return res.status(400).json({
                success: false,
                message: "Invalid order ID."
            });
        }

        if(!mongoose.isValidObjectId(riderId)){
            return res.status(400).json({
                success: false,
                message: "A valid rider ID is required."
            });
        }

        const order = await orderModel.findById(id);

        if(!order){
            return res.status(404).json({
                success: false,
                message: "Order not found."
            });
        }

        if(["Delivered", "Cancelled"].includes(order.orderStatus)){
            return res.status(400).json({
                success: false,
                message: "Cannot assign a rider to a completed or cancelled order."
            });
        }

        const rider = await riderModel.findOne({
            _id: riderId,
            isActive: true
        });

        if(!rider){
            return res.status(404).json({
                success: false,
                message: "Active rider not found."
            });
        }

        order.assignedRider = rider._id;

        // Do not change the order status here.
        // Existing admin preparation/status workflow remains intact.
        await order.save();

        return res.status(200).json({
            success: true,
            message: "Rider assigned successfully.",
            order
        });
    } catch (error) {
        console.error("Assign Rider Error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not assign rider to order."
        });
    }
};

// Get Assigned Orders — Rider Only
const getAssignedOrders = async (req, res) => {
    try {
        const orders = await orderModel.find({ assignedRider: req.riderId }).select("userId items subtotal amount promoCode " + "discountAmount deliveryDiscountAmount deliveryFee " + "address deliveryLocation " + "customerConfirmedLocation locationChangeStatus " + "paymentStatus paymentMethod orderStatus " + "preparationStartedAt assignedRider " + "riderDeliveryConfirmedAt deliveryOtpVerifiedAt riderCashCollected " + "riderCashCollectedAt riderCashCollectedAmount " + "deliveryDistanceKm riderEarning " + "riderEarningCalculatedAt deliveredAt " + "createdAt updatedAt").populate("userId", "name email").sort({ createdAt: -1 });

        const safeOrders = orders.map((order) => {
            const data = order.toObject();

            const originalLocation = data.deliveryLocation;

            const approvedLocation = data.locationChangeStatus === "Approved" && data.customerConfirmedLocation?.confirmedAt && Number.isFinite(data.customerConfirmedLocation?.latitude) &&Number.isFinite(data.customerConfirmedLocation?.longitude);

            // Only approved locations can replace the original destination.
            data.effectiveDeliveryLocation = approvedLocation ? {latitude: data.customerConfirmedLocation.latitude, longitude: data.customerConfirmedLocation.longitude} : originalLocation;

            // Never expose unapproved customer coordinates to riders.
            delete data.customerConfirmedLocation;

            // Preserve the existing deliveryLocation field for older clients.
            // Its value now represents the location the rider should use.
            data.deliveryLocation = data.effectiveDeliveryLocation;

            return data;
        });

        return res.status(200).json({
            success: true,
            count: safeOrders.length,
            orders: safeOrders
        });

    } catch (error) {
        console.error("Get Assigned Orders Error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not load assigned orders."
        });
    }
};

// Confirm Delivery — Rider Only
const confirmDelivery = async (req, res) => {
    try {
        const { id } = req.params;
        const { cashCollected } = req.body;

        if(!mongoose.isValidObjectId(id)){
            return res.status(400).json({
                success: false,
                message: "Invalid order ID."
            });
        }

        const order = await orderModel.findOne({
            _id: id,
            assignedRider: req.riderId
        });

        if(!order){
            return res.status(404).json({
                success: false,
                message: "Assigned order not found."
            });
        }

        if(order.orderStatus !== "Out for Delivery"){
            return res.status(400).json({
                success: false,
                message: "Only orders that are out for delivery can be completed."
            });
        }

        // Prevent duplicate confirmation.
        if(order.riderDeliveryConfirmedAt){
            return res.status(400).json({
                success: false,
                message: "Delivery has already been confirmed."
            });
        }

        // Require verified customer delivery OTP.
        if(!order.deliveryOtpVerifiedAt){
            return res.status(403).json({
                success: false,
                message: "Please verify the customer's delivery OTP before confirming delivery."
            });
        }

        if(order.paymentMethod === "Cash on Delivery"){
            if(cashCollected !== true){
                return res.status(400).json({
                    success: false,
                    message: "Confirm cash collection before completing this COD order."
                });
            }

            // Calculate the exact COD amount payable by the customer
            const codAmount = Number(order.amount) + Number(order.deliveryFee);

            // Validate the amount
            if(!Number.isFinite(codAmount) || codAmount < 0){
                return res.status(400).json({
                    success: false,
                    message: "Invalid COD collection amount."
                });
            }

            // Record COD cash collection
            order.riderCashCollected = true;
            order.riderCashCollectedAt = new Date();
            order.riderCashCollectedAmount = Math.round(codAmount * 100) / 100;

            // Mark COD payment as paid
            order.paymentStatus = "Paid";
            
        } else if(order.paymentStatus !== "Paid"){
            return res.status(400).json({
                success: false,
                message: "This order's payment is not confirmed."
            });
        }

        // Rider confirms delivery; admin still finalizes the Delivered status.
        order.riderDeliveryConfirmedAt = new Date();

        await order.save();

        return res.status(200).json({
            success: true,
            message: "Delivery confirmation saved. Awaiting admin finalization.",
            order: {
                _id: order._id,
                orderStatus: order.orderStatus,
                paymentStatus: order.paymentStatus,
                paymentMethod: order.paymentMethod,
                riderDeliveryConfirmedAt: order.riderDeliveryConfirmedAt,
                riderCashCollected: order.riderCashCollected,
                riderCashCollectedAt: order.riderCashCollectedAt,
                locationChangeStatus: order.locationChangeStatus
            }
        });
    } catch (error) {
        console.error("Confirm Delivery Error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not confirm delivery."
        });
    }
};

// Upload / Update Rider Avatar
const updateRiderAvatar = async (req, res) => {
    try {
        if(!req.file){
            return res.status(400).json({
                success: false,
                message: "Please select an image to upload."
            });
        }

        const rider = await riderModel.findOne({
            _id: req.riderId,
            isActive: true
        });

        if(!rider){
            await fs.promises.unlink(req.file.path).catch(() => {});

            return res.status(404).json({
                success: false,
                message: "Rider account not found."
            });
        }

        const previousAvatar = rider.avatar;

        rider.avatar = `/images/riders/${req.file.filename}`;

        try {
            await rider.save();
        } catch (error) {
            await fs.promises.unlink(req.file.path).catch(() => {});
            throw error;
        }

        // Delete the previous local avatar only after saving the new one.
        await deleteLocalRiderAvatar(
            previousAvatar,
            req.riderId
        );

        return res.status(200).json({
            success: true,
            message: "Profile picture updated successfully.",
            rider: formatRider(rider)
        });
    } catch (error) {
        console.error("Update Rider Avatar Error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not update profile picture."
        });
    }
};

// Delete Rider Avatar
const deleteRiderAvatar = async (req, res) => {
    try {
        const rider = await riderModel.findOne({
            _id: req.riderId,
            isActive: true
        });

        if(!rider){
            return res.status(404).json({
                success: false,
                message: "Rider account not found."
            });
        }

        if(!rider.avatar){
            return res.status(200).json({
                success: true,
                message: "No profile picture to delete.",
                rider: formatRider(rider)
            });
        }

        const previousAvatar = rider.avatar;

        rider.avatar = "";

        await rider.save();

        await deleteLocalRiderAvatar(
            previousAvatar,
            req.riderId
        );

        return res.status(200).json({
            success: true,
            message: "Profile picture deleted successfully.",
            rider: formatRider(rider)
        });
    } catch (error) {
        console.error("Delete Rider Avatar Error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not delete profile picture."
        });
    }
}

const googleRiderClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID
);

const verifyRiderGoogleCredential = async (credential) => {
    if(!process.env.GOOGLE_CLIENT_ID){
        throw new Error("GOOGLE_CLIENT_ID is not configured.");
    }

    if(!credential) {
        throw new Error("Google credential is required.");
    }

    const ticket = await googleRiderClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();

    if(!payload || !payload.email || payload.email_verified !== true){
        throw new Error("Google account email is not verified.");
    }

    return {
        name: payload.name || payload.email.split("@")[0],
        email: payload.email.toLowerCase().trim()
    };
};

// Google Rider Login
const googleRiderLogin = async (req, res) => {
    try {
        const { credential } = req.body;

        const googleUser = await verifyRiderGoogleCredential(credential);

        const rider = await riderModel.findOne({
            email: googleUser.email
        });

        if(!rider){
            return res.status(404).json({
                success: false,
                message: "Rider account not found. Please register first."
            });
        }

        if(!rider.isActive){
            return res.status(403).json({
                success: false,
                message: "Your Rider account is inactive."
            });
        }

        const token = jwt.sign(
            {
                id: rider._id.toString(),
                role: "rider"
            },
            process.env.RIDER_JWT_SECRET,
            {
                expiresIn: "7d"
            }
        );

        return res.json({
            success: true,
            token,
            rider: {
                _id: rider._id,
                name: rider.name,
                email: rider.email,
                phone: rider.phone,
                vehicleType: rider.vehicleType,
                avatar: rider.avatar,
                isActive: rider.isActive
            }
        });
    } catch (error) {
        console.error("Google Rider Login Error:", error.message);

        return res.status(400).json({
            success: false,
            message: "Google login failed. Please try again."
        });
    }
};

// Google Rider Register
const googleRiderRegister = async (req, res) => {
    try {
        const { credential, phone, vehicleType } = req.body;

        if(!process.env.RIDER_JWT_SECRET){
            return res.status(500).json({
                success: false,
                message: "Rider authentication is not configured."
            });
        }

        const googleUser = await verifyRiderGoogleCredential(credential);

        const allowedVehicles = ["Motorcycle", "Bicycle", "Scooter", "Other"];

        if(vehicleType && !allowedVehicles.includes(vehicleType)){
            return res.status(400).json({
                success: false,
                message: "Invalid vehicle type."
            });
        }

        const existingRider = await riderModel.findOne({
            email: googleUser.email
        });

        if(existingRider){
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists. Please log in."
            });
        }

        // Google-registered accounts receive a random password hash.
        // The user authenticates using Google rather than this password.
        const randomPassword = randomBytes(32).toString("hex");
        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        const rider = await riderModel.create({
            name: googleUser.name,
            email: googleUser.email,
            password: hashedPassword,
            phone: typeof phone === "string" ? phone.trim() : "",
            vehicleType: vehicleType || "Motorcycle"
        });

        const token = jwt.sign(
            {
                id: rider._id.toString(),
                role: "rider"
            },
            process.env.RIDER_JWT_SECRET,
            { expiresIn: "7d" }
        );

        return res.status(201).json({
            success: true,
            token,
            rider: {
                _id: rider._id,
                name: rider.name,
                email: rider.email,
                phone: rider.phone,
                vehicleType: rider.vehicleType,
                avatar: rider.avatar,
                isActive: rider.isActive
            }
        });

    } catch (error) {
        console.error("Google Rider Register Error:", error.message);

        return res.status(400).json({
            success: false,
            message: "Google registration failed. Please try again."
        });
    }
}

const updateRiderProfile = async (req, res) => {
    try {
        const { name, phone, vehicleType } = req.body;

        if(!name || !name.trim() || !phone || !phone.trim() || !vehicleType){
            return res.status(400).json({
                success: false,
                message: "Name, mobile number and vehicle type are required."
            });
        }

        const cleanName = name.trim();
        const cleanPhone = phone.trim();

        if(cleanName.length < 2 || cleanName.length > 100){
            return res.status(400).json({
                success: false,
                message: "Name must be between 2 and 100 characters."
            });
        }

        if(cleanPhone.length > 30){
            return res.status(400).json({
                success: false,
                message: "Mobile number is too long."
            });
        }

        const allowedVehicles = ["Motorcycle", "Bicycle", "Scooter", "Other"];

        if(!allowedVehicles.includes(vehicleType)){
            return res.status(400).json({
                success: false,
                message: "Invalid vehicle type."
            });
        }

        const rider = await riderModel.findById(req.riderId);

        if(!rider){
            return res.status(404).json({
                success: false,
                message: "Rider not found."
            });
        }

        rider.name = cleanName;
        rider.phone = cleanPhone;
        rider.vehicleType = vehicleType;

        await rider.save();

        return res.json({
            success: true,
            message: "Rider profile updated successfully.",
            rider: formatRider(rider)
        });

    } catch (error) {
        console.error("Update Rider Profile Error:", error);
        
        return res.status(500).json({
            success: false,
            message: "Unable to update rider profile."
        })
    }
}

// Format bank details without exposing the full account number
const formatRiderBankDetails = (rider) => {
    const bank = rider.bankDetails || {};

    const encryptedNumber = String(
        bank.accountNumber || ""
    );

    let maskedAccountNumber = "";

    if(encryptedNumber){
        const accountNumber = decryptBankAccount(
            encryptedNumber
        );

        maskedAccountNumber = `****${accountNumber.slice(-4)}`;
    }

    return {
        bankName: bank.bankName || "",
        accountHolderName: bank.accountHolderName || "",
        branchName: bank.branchName || "",
        hasAccountNumber: Boolean(encryptedNumber),
        maskedAccountNumber
    };
};

// Get Rider Bank Details — Rider Only
const getRiderBankDetails = async (req, res) => {
    try {
        const rider = await riderModel.findOne({ _id: req.riderId, isActive: true }).select("+bankDetails.accountNumber");

        if(!rider){
            return res.status(404).json({
                success: false,
                message: "Rider not found."
            });
        }

        return res.status(200).json({
            success: true,
            bankDetails: formatRiderBankDetails(rider)
        });

    } catch (error) {
        console.error("Get Rider Bank Details Error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not load bank details."
        });
    }
};

// Save / Update Rider Bank Details — Rider Only
const updateRiderBankDetails = async (req, res) => {
    try {
        const { bankName, accountHolderName, accountNumber, branchName } = req.body || {};

        const fields = [bankName, accountHolderName, branchName];

        if(fields.some((value) => typeof value !== "string" || !value.trim() || value.trim().length > 100)){
            return res.status(400).json({
                success: false,
                message: "Please provide valid bank, account holder and branch names."
            });
        }

        // Account number may be omitted when updating other details.
        if(accountNumber !== undefined && (typeof accountNumber !== "string" || !/^[0-9]{6,20}$/.test(accountNumber.trim()))){
            return res.status(400).json({
                success: false,
                message: "Account number must contain 6 to 20 digits."
            });
        }

        const rider = await riderModel.findOne({ _id: req.riderId, isActive: true }).select("+bankDetails.accountNumber");

        if(!rider){
            return res.status(404).json({
                success: false,
                message: "Rider not found."
            });
        }

        // Preserve the existing encrypted account number
        const existingEncryptedNumber = rider.bankDetails?.accountNumber || "";

        const finalAccountNumber = accountNumber === undefined ? existingEncryptedNumber : encryptBankAccount(accountNumber.trim());

        if(!finalAccountNumber){
            return res.status(400).json({
                success: false,
                message: "Bank account number is required."
            });
        }

        rider.set("bankDetails", {
            bankName: bankName.trim(),
            accountHolderName: accountHolderName.trim(),
            accountNumber: finalAccountNumber,
            branchName: branchName.trim()
        });

        await rider.save();

        return res.status(200).json({
            success: true,
            message: "Bank details updated successfully.",
            bankDetails: formatRiderBankDetails(rider)
        });

    } catch (error) {
        console.error("Update Rider Bank Details Error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not update bank details."
        });
    }
}

// Get Rider Bank Details for Admin
const getRiderBankDetailsForAdmin = async (req, res) => {
    try {
        const { riderId } = req.params;

        if(!mongoose.isValidObjectId(riderId)){
            return res.status(400).json({
                success: false,
                message: "Invalid rider ID."
            });
        }

        if(!mongoose.isValidObjectId(req.adminId)){
            return res.status(401).json({
                success: false,
                message: "Admin authentication is required."
            });
        }

        const rider = await riderModel.findById(riderId).select("name email bankDetails.bankName " + "bankDetails.accountHolderName " + "bankDetails.branchName " + "+bankDetails.accountNumber");

        if(!rider){
            return res.status(404).json({
                success: false,
                message: "Rider not found."
            });
        }

        const bank = rider.bankDetails || {};
        const encryptedNumber = bank.accountNumber || "";

        // Never expose encrypted data or the full account number.
        let maskedAccountNumber = "";

        if(encryptedNumber){
            const accountNumber = decryptBankAccount(encryptedNumber);

            maskedAccountNumber = `****${accountNumber.slice(-4)}`;
        }

        console.info("Admin accessed rider bank details", {
            adminId: String(req.adminId),
            riderId: String(rider._id),
            accessedAt: new Date().toISOString()
        });

        return res.status(200).json({
            success: true,
            rider: {
                _id: rider._id,
                name: rider.name,
                email: rider.email
            },
            bankDetails: {
                bankName: bank.bankName || "",
                accountHolderName:
                    bank.accountHolderName || "",
                branchName: bank.branchName || "",
                hasAccountNumber: Boolean(encryptedNumber),
                maskedAccountNumber
            }
        });

    } catch (error) {
        console.error("Get Rider Bank Details For Admin Error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not load rider bank details."
        });
    }
}

export {loginRider, registerRider, getRiderProfile, getAssignedOrders, confirmDelivery, createRider, getAllRiders, assignRiderToOrder, updateRiderAvatar, deleteRiderAvatar, uploadRiderAvatar, googleRiderLogin, googleRiderRegister, updateRiderProfile, getRiderBankDetails, updateRiderBankDetails, getRiderBankDetailsForAdmin }