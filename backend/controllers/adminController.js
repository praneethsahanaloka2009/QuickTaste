import adminModel from "../models/adminModel.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import validator from "validator";
import { OAuth2Client } from "google-auth-library";
import fs from "fs";
import path from "path";

// Google OAuth Client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Create Admin JWT Token
const createAdminToken = (id) => {
    return jwt.sign({id: id.toString()}, process.env.ADMIN_JWT_SECRET,{expiresIn: "7d"});
};

// Admin Register
const registerAdmin = async (req,res) => {
    const {name, email, password} = req.body;

    try {
        
        // checking is already exists
        const exists = await adminModel.findOne({email});

        if(exists){
            return res.status(400).json({
                success : false,
                message : "Admin already exists!"
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

        // hashing admin password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // create admin
        const newAdmin = new adminModel({
            name : name,
            email : email,
            password : hashedPassword
        })

        const admin = await newAdmin.save();

        const token = createAdminToken(admin._id);

        res.status(201).json({
            success : true,
            token
        });

    } catch (error) {
        
        console.log("Admin Register Error:", error);

        res.status(500).json({
            success : false,
            message : "Something went wrong. Please try again."
        })
    }
}

// Admin Login
const loginAdmin = async (req,res) => {
    const {email, password} = req.body;

    try {
        const admin = await adminModel.findOne({email});

        if(!admin){
            return res.status(400).json({
                success : false,
                message : "Admin not exists!"
            });
        }

        // Google admin don't have a password
        if(!admin.password){
            return res.status(400).json({
                success : false,
                message : "Please login with Google."
            })
        }

        const isMatch = await bcrypt.compare(password, admin.password);

        if(!isMatch){
            return res.status(400).json({
                success : false,
                message : "Invalid Credentials!"
            });
        }

        const token = createAdminToken(admin._id);

        res.status(200).json({
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

// Google Admin Register
const googleAdminRegister = async (req,res) => {

    const { credential } = req.body;

    try {
        const { name, email } = await verifyGoogleCredential(credential);

        // Check if admin already exists
        const exists = await adminModel.findOne({email});

        if(exists){
            return res.status(400).json({
                success : false,
                message : "Account already exists. Please Login."
            });
        }

        // Create new Google admin
        const admin = await adminModel.create({
            name : name,
            email : email
        });

        // Create JWT token
        const token = createAdminToken(admin._id);

        res.status(201).json({
            success : true,
            token
        });

    } catch (error) {
        
        console.log("Google Admin Register Error:", error);

        res.status(400).json({
            success : false,
            message : error.message || "Google registration failed. Please try again."
        });

    }

}

// Google Admin Login
const googleAdminLogin = async (req,res) => {

    const { credential } = req.body;

    try {
        const { email } = await verifyGoogleCredential(credential);

        // Find existing admin
        const admin = await adminModel.findOne({email});

        // Account doesn't exist
        if(!admin){
            return res.status(400).json({
                success : false,
                message : "Account not found. Please register first."
            });
        }

        // Email/password admin cannot login with Google
        if(admin.password){
            return res.status(400).json({
                success : false,
                message : "Please login with your email and password."
            })
        }

        // Create JWT token
        const token = createAdminToken(admin._id);

        res.status(200).json({
            success : true,
            token
        });
        
    } catch (error) {
        
        console.log("Google Admin Login Error:", error);

        res.status(400).json({
            success : false,
            message : error.message || "Google authentication failed!"
        });

    }

}

// Get Admin Profile
const getAdminProfile = async (req,res) => {
    try {
        const admin = await adminModel.findById(req.adminId).select("-password");

        if(!admin){
            return res.status(404).json({
                success: false,
                message: "Admin not found."
            });
        }

        return res.status(200).json({
            success: true,
            admin
        });
    } catch (error) {
        console.error("Get Admin Profile Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to get admin profile."
        });
    }
};

// Upload Admin Profile Picture
const uploadAdminProfilePicture = async (req,res) => {
    try {
        if(!req.file){
            return res.status(400).json({
                success: false,
                message: "Please select an image."
            });
        }

        const admin = await adminModel.findById(req.adminId);

        if(!admin){
            return res.status(404).json({
                success: false,
                message: "Admin not found."
            });
        }

        // Delete previous image when changing the picture
        if(admin.avatar){
            const oldImagePath = path.join(
                "uploads",
                path.basename(admin.avatar)
            );

            if(fs.existsSync(oldImagePath)){
                fs.unlinkSync(oldImagePath);
            }
        }

        admin.avatar = req.file.filename;
        await admin.save();

        return res.status(200).json({
            success: true,
            message: "Profile picture updated successfully!",
            admin: {
                name: admin.name,
                email: admin.email,
                avatar: admin.avatar
            }
        });

    } catch (error) {
        console.error("Admin Profile Picture Upload Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to upload profile picture."
        });
    }
};

// Remove Admin Profile Picture
const removeAdminProfilePicture = async (req,res) => {
    try {
        const admin = await adminModel.findById(req.adminId);

        if(!admin){
            return res.status(404).json({
                success: false,
                message: "Admin not found."
            });
        }

        // Delete image from uploads folder
        if(admin.avatar){
            const imagePath = path.join(
                "uploads",
                path.basename(admin.avatar)
            );

            if(fs.existsSync(imagePath)){
                fs.unlinkSync(imagePath);
            }
        }

        admin.avatar = "";
        await admin.save();

        return res.status(200).json({
            success: true,
            message: "Profile picture removed successfully!",
            admin: {
                name: admin.name,
                email: admin.email,
                avatar: admin.avatar
            }
        });

    } catch (error) {
        console.error("Remove Admin Profile Picture Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to remove profile picture."
        });
    }
}

export {registerAdmin, loginAdmin, googleAdminRegister, googleAdminLogin, getAdminProfile, uploadAdminProfilePicture, removeAdminProfilePicture};