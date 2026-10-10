import adminModel from "../models/adminModel.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import validator from "validator";
import { OAuth2Client } from "google-auth-library";

// Google OAuth Client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Create Admin JWT Token
const createAdminToken = (id) => {
    return jwt.sign({id}, process.env.ADMIN_JWT_SECRET);
}

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
const loginAdmin = async (req, res) => {
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

export {registerAdmin, loginAdmin, googleAdminRegister, googleAdminLogin};