import userModel from "../models/userModel.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import validator from "validator";
import { OAuth2Client } from "google-auth-library";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";

// Google OAuth Client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Create JWT Token
const createToken = (id) => {
    return jwt.sign({id}, process.env.JWT_SECRET)
}

// Login user
const loginUser = async (req, res) => {
    const {email, password} = req.body;

    try {
        const user = await userModel.findOne({email});

        if(!user){
            return res.status(400).json({
                success : false,
                message : "User not exists!"
            });
        }

        // Google user don't have a password
        if(!user.password){
            return res.status(400).json({
                success : false,
                message : "Please login with Google."
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if(!isMatch){
            return res.status(400).json({
                success : false,
                message : "Invalid Credentials!"
            });
        }

        const token = createToken(user._id);

        res.status(200).json({
            success : true,
            token
        });

    } catch(error) {
        console.log(error);

        res.status(500).json({
            success : false,
            message : "Error"
        })
    }
}

// Register User
const registerUser = async (req,res) => {
    const {name, email, password} = req.body;

    try {

        // checking is already exists
        const exists = await userModel.findOne({email});

        if(exists){
            return res.status(400).json({
                success : false,
                message : "User already exists!"
            })
        }

        // valid email format
        if(!validator.isEmail(email)){
            return res.status(400).json({
                success : false,
                message : "Please enter a valid email address!"
            })
        }

        // validate password
        if(password.length < 8){
            return res.status(400).json({
                success : false,
                message : "Password must be at least 8 characters long!"
            })
        }

        // hashing user password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // create new user
        const newUser = new userModel({
            name : name,
            email : email,
            password : hashedPassword
        })

        const user = await newUser.save();

        const token = createToken(user._id);

        res.status(201).json({
            success : true,
            token
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success : false,
            message : "Error"
        })
    }
}

// Verify Google credential
const verifyGoogleCredential = async (credential) => {

    if(!credential){
        throw new Error("Google credential is required!");
    }

    const ticket = await googleClient.verifyIdToken({
        idToken : credential,
        audience : process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();

    if(!payload.email_verified){
        throw new Error("Google email is not verified!");
    }

    return {
        name : payload.name,
        email : payload.email
    };

}

// Google Register
const googleRegister = async (req,res) => {

    const { credential } = req.body;

    try {
        
        const { name, email } = await verifyGoogleCredential(credential);

        // Check if user already exists
        const exists = await userModel.findOne({email});

        if(exists){
            return res.status(400).json({
                success : false,
                message : "Account already exists. Please Login."
            });
        }

        // Create new Google user
        const user = await userModel.create({
            name : name,
            email : email,
            cartData : {}
        });

        // Create JWT token
        const token = createToken(user._id);

        res.status(201).json({
            success : true,
            token
        })

    } catch (error) {
        
        console.log("Google Register Error:", error);

        res.status(400).json({
            success : false,
            message : error.message || "Google registration failed. Please try again."
        });

    }

}

// Google Login
const googleLogin = async (req,res) => {

    const { credential } = req.body;

    try {

        const { email } = await verifyGoogleCredential(credential);

        // Find existing user
        const user = await userModel.findOne({email});

        // Account doesn't exist
        if(!user){
            return res.status(400).json({
                success : false,
                message : "Account not found. Please register first."
            });
        }

        // Email/password user cannot login with Google
        if(user.password){
            return res.status(400).json({
                success : false,
                message : "Please login with your email and password."
            })
        }

        // Create JWT token
        const token = createToken(user._id);

        res.status(200).json({
            success : true,
            token
        });
        
    } catch (error) {
        
        console.log("Google Login Error:", error);

        res.status(400).json({
            success : false,
            message : error.message || "Google authentication failed!"
        });

    }

}

// Get User Profile
const getUserProfile = async (req,res) => {

    try {

        const user = await userModel.findById(req.userId).select("-password");

        if(!user){
            return res.status(404).json({
                success : false,
                message : "User not found!"
            });
        }

        res.status(200).json({
            success : true,
            user
        });
        
    } catch (error) {
        
        console.log("Get User Profile Error:", error);

        res.status(500).json({
            success : false,
            message : "Error"
        })

    }

}

// Update Customer Personal Information
const updateUserProfile = async (req, res) => {
    try {
        const { name, phone } = req.body || {};

        if(typeof name !== "string"){
            return res.status(400).json({
                success: false,
                message: "Please enter your full name."
            });
        }

        const cleanName = name.trim();

        if(cleanName.length < 2 || cleanName.length > 80){
            return res.status(400).json({
                success: false,
                message: "Full name must contain 2 to 80 characters."
            });
        }

        if(phone !== undefined && typeof phone !== "string"){
            return res.status(400).json({
                success: false,
                message: "Invalid phone number."
            });
        }

        const cleanPhone = (phone || "").trim();

        if(cleanPhone && !/^\+?[0-9][0-9\s()-]{6,19}$/.test(cleanPhone)){
            return res.status(400).json({
                success: false,
                message: "Please enter a valid phone number."
            });
        }

        const user = await userModel.findByIdAndUpdate(
            req.userId,
            {
                $set: {
                    name: cleanName,
                    phone: cleanPhone
                }
            },
            {
                returnDocument: "after",
                runValidators: true
            }
        ).select("-password");

        if(!user){
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully!",
            user
        });
        
    } catch (error) {
        console.error("Update User Profile Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to update profile."
        });
    }
};

// Update User Profile Picture
const updateProfilePicture = async (req,res) => {

    try {
        
        if(!req.file){
            return res.status(400).json({
                success : false,
                message : "No image uploaded!"
            });
        }

        const user = await userModel.findByIdAndUpdate(req.userId, { avatar : req.file.filename }, { returnDocument : "after" }).select("-password");

        if(!user){
            return res.status(404).json({
                success : false,
                message : "User not found!"
            });
        }

        res.status(200).json({
            success : true,
            message : "Profile picture updated successfully!",
            user
        });

    } catch (error) {
        
        console.log("Profile Picture Error:", error);

        res.status(500).json({
            success : false,
            message : "Error uploading profile picture"
        });

    }

}

// Remove User Profile Picture
const removeProfilePicture = async (req, res) => {

    try {
        
        const user = await userModel.findById(req.userId);

        if(!user){
            return res.status(404).json({
                success : false,
                message : "User not found!"
            })
        }

        // Delete old image from uploads folder
        if(user.avatar){

            const imagePath = path.join("uploads", user.avatar);

            if(fs.existsSync(imagePath)){
                fs.unlinkSync(imagePath);
            }

        }

        // Remove avatar from database
        user.avatar = "";

        await user.save();

        const updatedUser = await userModel.findById(req.userId).select("-password");

        res.status(200).json({
            success : true,
            message : "Profile picture removed successfully!",
            user : updatedUser
        });

    } catch (error) {
        
        console.log("Remove Profile Picture Error:", error);

        res.status(500).json({
            success : false,
            message : "Error removing profile picture"
        });

    }

}

// Add Item(s) to Cart
const addToCart = async (req, res) => {
    try {
        const { itemId, quantity = 1 } = req.body;

        // Validate item ID
        if(!itemId || !mongoose.isValidObjectId(itemId)){
            return res.status(400).json({
                success: false,
                message: "Valid Item ID is required!"
            });
        }

        // Validate quantity
        if(!Number.isInteger(quantity) || quantity < 1 || quantity > 20){
            return res.status(400).json({
                success: false,
                message: "Quantity must be between 1 and 20."
            });
        }

        const user = await userModel.findById(req.userId);

        if(!user){
            return res.status(404).json({
                success: false,
                message: "User not found!"
            });
        }

        if(!user.cartData){
            user.cartData = {};
        }

        // Add selected quantity
        const currentQuantity = Number(user.cartData[itemId] || 0);

        user.cartData[itemId] = currentQuantity + quantity;

        user.markModified("cartData");

        await user.save();

        return res.status(200).json({
            success: true,
            message: quantity === 1 ? "Item added to cart!" : `${quantity} items added to cart!`,
            cartData: user.cartData
        });

    } catch (error) {
        console.error("Add To Cart Error:", error);

        return res.status(500).json({
            success: false,
            message: "Error adding item to cart"
        });
    }
}

// Remove Item(s) From Cart
const removeFromCart = async (req, res) => {

    try {

        const { itemId } = req.body;

        if(!itemId){
            return res.status(400).json({
                success : false,
                message : "Item ID is required!"
            });
        }

        const user = await userModel.findById(req.userId);

        if(!user){
            return res.status(404).json({
                success : false,
                message : "User not found!"
            });
        }

        if(user.cartData && user.cartData[itemId]){

            user.cartData[itemId] -= 1;

            if(user.cartData[itemId] <= 0){
                delete user.cartData[itemId];
            }

            user.markModified("cartData");

            await user.save();
        }

        res.status(200).json({
            success : true,
            message : "Food Item removed from cart!",
            cartData : user.cartData
        });

    } catch (error) {

        console.log("Remove From Cart Error:", error);

        res.status(500).json({
            success : false,
            message : "Error removing item from cart"
        });

    }

}

// Get User Cart
const getCart = async (req, res) => {

    try {

        const user = await userModel.findById(req.userId).select("cartData");

        if(!user){
            return res.status(404).json({
                success : false,
                message : "User not found!"
            });
        }

        res.status(200).json({
            success : true,
            cartData : user.cartData || {}
        });

    } catch (error) {

        console.log("Get Cart Error:", error);

        res.status(500).json({
            success : false,
            message : "Error getting cart"
        });

    }

}

export {loginUser, registerUser, googleLogin, googleRegister, getUserProfile, updateUserProfile, updateProfilePicture, removeProfilePicture, addToCart, removeFromCart, getCart};