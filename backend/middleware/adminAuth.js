import jwt from "jsonwebtoken";

const adminAuth = async(req,res,next) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];

        if(!token){
            return res.status(401).json({
                success : false,
                message : "Not Authorized. Please Login."
            });
        }

        const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);

        req.adminId = decoded.id;

        next();

    } catch (error) {
        console.log("Admin Auth Error:", error);

        return res.status(401).json({
            success : false,
            message : "Invalid or expired admin token."
        });
    }
}

export default adminAuth;