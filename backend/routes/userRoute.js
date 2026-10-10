import express from 'express';
import multer from 'multer';
import { loginUser, registerUser, googleLogin, googleRegister, getUserProfile, updateProfilePicture, removeProfilePicture, addToCart, removeFromCart, getCart } from '../controllers/userController.js';
import authMiddleware from '../middleware/auth.js';

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
userRouter.get("/profile", authMiddleware, getUserProfile)

// Profile Picture
userRouter.post("/profile-picture", authMiddleware, upload.single("avatar"), updateProfilePicture)
userRouter.delete("/profile-picture", authMiddleware, removeProfilePicture)

// Cart Routes
userRouter.post("/cart/add", authMiddleware, addToCart);
userRouter.post("/cart/remove", authMiddleware, removeFromCart);
userRouter.get("/cart", authMiddleware, getCart);

export default userRouter;