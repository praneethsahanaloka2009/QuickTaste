import express from 'express';
import multer from 'multer';
import { loginUser, registerUser, googleLogin, googleRegister, getUserProfile, updateUserProfile, updateProfilePicture, removeProfilePicture, addToCart, removeFromCart, getCart } from '../controllers/userController.js';
import { getSavedAddresses, addSavedAddress, updateSavedAddress, setDefaultAddress, deleteSavedAddress } from "../controllers/savedAddressController.js";
import authMiddleware from '../middleware/auth.js';
import { addCustomizedToCart, getCustomizedCart, removeCustomizedFromCart } from '../controllers/customizedCartController.js';

const userRouter = express.Router();

// Multer config
const storage = multer.diskStorage({

    destination : (req,file,cb) => {
        cb(null, "uploads");
    },

    filename : (req,file,cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }

});

const upload = multer({ storage });

// Auth Routes
userRouter.post("/register", registerUser);
userRouter.post("/login", loginUser);
userRouter.post("/google-login", googleLogin);
userRouter.post("/google-register", googleRegister);

// User Profile
userRouter.get("/profile", authMiddleware, getUserProfile);
userRouter.put("/profile", authMiddleware, updateUserProfile);

// Profile Picture
userRouter.post("/profile-picture", authMiddleware, upload.single("avatar"), updateProfilePicture);
userRouter.delete("/profile-picture", authMiddleware, removeProfilePicture);

// Customer Saved Delivery Addresses
userRouter.get("/addresses", authMiddleware, getSavedAddresses);
userRouter.post("/addresses", authMiddleware, addSavedAddress);
userRouter.put("/addresses/:addressId", authMiddleware, updateSavedAddress);
userRouter.put("/addresses/:addressId/default", authMiddleware, setDefaultAddress);
userRouter.delete("/addresses/:addressId", authMiddleware, deleteSavedAddress);

// Cart Routes
userRouter.post("/cart/add", authMiddleware, addToCart);
userRouter.post("/cart/remove", authMiddleware, removeFromCart);
userRouter.get("/cart", authMiddleware, getCart);

// Customized Cart Routes
userRouter.post("/custom-cart/add", authMiddleware, addCustomizedToCart);
userRouter.get("/custom-cart", authMiddleware, getCustomizedCart);
userRouter.post("/custom-cart/remove", authMiddleware, removeCustomizedFromCart);

export default userRouter;