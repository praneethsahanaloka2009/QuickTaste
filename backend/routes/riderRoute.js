import express from "express";
import riderAuth from "../middleware/riderAuth.js";
import {loginRider, registerRider, getRiderProfile, getAssignedOrders, confirmDelivery, updateRiderAvatar, deleteRiderAvatar, uploadRiderAvatar, googleRiderLogin, googleRiderRegister, updateRiderProfile, getRiderBankDetails, updateRiderBankDetails} from "../controllers/riderController.js";

const riderRouter = express.Router();

// Rider Authentication
// Rider Login/Register
riderRouter.post("/login", loginRider);
riderRouter.post("/register", registerRider);

// Rider Google Login/Register
riderRouter.post("/google-login", googleRiderLogin);
riderRouter.post("/google-register", googleRiderRegister);

// Rider Profile
// Get and update rider profile
riderRouter.get("/profile", riderAuth, getRiderProfile);
riderRouter.put("/profile", riderAuth, updateRiderProfile);

// Upload or update profile picture
riderRouter.put("/profile/avatar", riderAuth, uploadRiderAvatar.single("avatar"), updateRiderAvatar);

// Delete profile picture
riderRouter.delete("/profile/avatar", riderAuth, deleteRiderAvatar);

// Rider Bank Account Details
// Get logged-in rider bank details
riderRouter.get("/bank-details", riderAuth, getRiderBankDetails);

// Save or update logged-in rider bank details
riderRouter.put("/bank-details", riderAuth, updateRiderBankDetails);

// Rider Orders
// Get orders assigned to the logged-in rider
riderRouter.get("/orders", riderAuth, getAssignedOrders);

// Confirm delivery
riderRouter.put("/orders/:id/confirm-delivery", riderAuth, confirmDelivery);

export default riderRouter;