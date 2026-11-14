import express from "express";
import multer from "multer";
import { loginAdmin, registerAdmin, googleAdminLogin, googleAdminRegister, getAdminProfile, removeAdminProfilePicture, uploadAdminProfilePicture } from "../controllers/adminController.js";
import { createRider, getAllRiders, assignRiderToOrder, getRiderBankDetailsForAdmin } from "../controllers/riderController.js";
import { getRiderEarningsSettings, updateRiderEarningsSettings } from "../controllers/riderEarningsController.js";
import adminAuth from "../middleware/adminAuth.js";
import { approveCustomerLocation, rejectCustomerLocation } from "../controllers/adminLocationController.js";

const adminRouter = express.Router();

// Multer Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads");
    },

    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

const upload = multer({
    storage,
    limits : {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        if(file.mimetype.startsWith("image/")){
            cb(null, true);
        } else {
            cb(new Error("Only image files are allowed."));
        }
    }
});

// Admin Authentication Routes
adminRouter.post("/register", (req, res) => {
    return res.status(403).json({
        success: false,
        message: "Public admin registration is disabled."
    });
});

adminRouter.post("/login", loginAdmin);

adminRouter.post("/google-register", (req, res) => {
    return res.status(403).json({
        success: false,
        message: "Public admin registration is disabled."
    });
});

adminRouter.post("/google-login", googleAdminLogin);

// Admin Profile
adminRouter.get("/profile", adminAuth, getAdminProfile);

// Profile Picture
adminRouter.post("/profile-picture", adminAuth, upload.single("avatar"), uploadAdminProfilePicture);
adminRouter.delete("/profile-picture", adminAuth, removeAdminProfilePicture);

// Rider Management — Admin Only
adminRouter.post("/riders", adminAuth, createRider);
adminRouter.get("/riders", adminAuth, getAllRiders);
adminRouter.put("/orders/:id/assign-rider", adminAuth, assignRiderToOrder);
adminRouter.get("/riders/:riderId/bank-details", adminAuth, getRiderBankDetailsForAdmin);

// Rider Earnings Settings — Admin Only
adminRouter.get("/rider-earnings/settings", adminAuth, getRiderEarningsSettings);
adminRouter.put("/rider-earnings/settings", adminAuth, updateRiderEarningsSettings);

// Customer Location Approval — Admin Only
adminRouter.put("/orders/:id/approve-location", adminAuth, approveCustomerLocation);
adminRouter.put("/orders/:id/reject-location", adminAuth, rejectCustomerLocation);

export default adminRouter;