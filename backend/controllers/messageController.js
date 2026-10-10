import messageModel from "../models/messageModel.js";
import nodemailer from 'nodemailer';

console.log("EMAIL PASS:", process.env.EMAIL_PASS ? "Loaded" : "Missing")

// Email Transporter
const transporter = nodemailer.createTransport({

    service : "gmail",
    auth : {
        user : process.env.EMAIL_USER,
        pass : process.env.EMAIL_PASS
    }

});

// Add Message
const addMessage = async (req, res) => {

    try {
        const {name, email, subject, message} = req.body;

        const newMessage = new messageModel({name, email, subject, message});

        await newMessage.save();

        res.json({
            success : true,
            message : "Message sent successfully"
        });

    } catch (error) {
        
        console.log(error);

        res.json({
            success : false,
            message : "Something went wrong!"
        })

    }

};

// Get All Messages
const getMessages = async (req, res) => {

    try {
        const messages = await messageModel.find({}).sort({ createdAt: -1 });

        res.json({
            success : true,
            data : messages
        });

    } catch (error) {

        console.log(error);

        res.json({
            success : false,
            message : "Something went wrong!"
        })
    }

}

// Remove Messages
const removeMessage = async (req, res) => {

    try {
        const { id } = req.body;

        await messageModel.findByIdAndDelete(id);

        res.json({
            success : true,
            message : "Message deleted successfully"
        })
        
    } catch (error) {
        
        console.log(error);

        res.json({
            success : false,
            message : "Something went wrong!"
        })

    }

}

// Reply to Customer
const sendReply = async (req, res) => {

    try {
        const {email, subject, message} = req.body;

        await transporter.sendMail({
            from : process.env.EMAIL_USER,
            to : email,
            subject : subject,
            text : message
        })

        res.json({
            success : true,
            message : "Reply sent successfully"
        })
    } catch (error) {
        
        console.log("Email Error:", error);

        res.json({
            success : false,
            message : "Failed to send reply"
        });

    }

};

export { addMessage, getMessages, removeMessage, sendReply};