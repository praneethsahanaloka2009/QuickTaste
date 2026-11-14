import jwt from "jsonwebtoken";
import riderModel from "../models/riderModel.js";

const riderAuth = async (req, res, next) => {
    
    try {
        const token = req.headers.authorization?.split(" ")[1];

        if(!token){
            return res.status(401).json({
                success: false,
                message: "Rider login required."
            });
        }

        if(!process.env.RIDER_JWT_SECRET){
            console.error("RIDER_JWT_SECRET is missing.");

            return res.status(500).json({
                success: false,
                message: "Rider authentication is not configured."
            });
        }

        const decoded = jwt.verify(token, process.env.RIDER_JWT_SECRET);

        if(decoded.role !== "rider" || !decoded.id){
            return res.status(401).json({
                success: false,
                message: "Invalid rider token."
            });
        }

        const rider = await riderModel.findById(decoded.id);

        if(!rider || !rider.isActive){
            return res.status(401).json({
                success: false,
                message: "Rider account is unavailable."
            });
        }

        req.riderId = rider._id.toString();
        req.rider = rider;

        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired rider token."
        });
    }

};

export default riderAuth;