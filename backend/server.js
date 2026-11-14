import "dotenv/config";
import express from "express";
import cors from "cors";

import { connectDB } from "./config/DB.js";

import foodRouter from "./routes/foodRoute.js";
import userRouter from "./routes/userRoute.js";
import adminRouter from "./routes/adminRoute.js";
import messageRouter from "./routes/messageRoute.js";
import ratingRouter from "./routes/ratingRoute.js";
import orderRouter from "./routes/orderRoute.js";
import paymentRouter from "./routes/paymentRoute.js";
import dashboardRouter from "./routes/dashboardRoute.js";
import analyticsRouter from "./routes/analyticsRoute.js";
import promoRouter from "./routes/promoRoute.js";
import riderRouter from "./routes/riderRoute.js";
import branchRouter from "./routes/branchRoute.js";
import locationConfirmationRouter from "./routes/locationConfirmationRoute.js";
import deliveryOtpRouter from "./routes/deliveryOtpRoute.js";
import codSettlementRouter from "./routes/codSettlementRoute.js";
import riderPayoutRouter from "./routes/riderPayoutRoute.js";
import subscriptionRouter from "./routes/subscriptionRoute.js";
import membershipRouter from "./routes/membershipRoute.js";
import supportChatRouter from "./routes/supportChatRoute.js";
import { createServer } from "node:http";
import { initializeSocket } from "./config/socket.js";

import { stripeWebhook } from "./controllers/paymentController.js";
import { subscriptionStripeWebhook } from "./controllers/subscriptionWebhookController.js";

// App config
const app = express();
const port = Number(process.env.PORT) || 4911;

// Middleware
const allowedOrigins = ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", process.env.FRONTEND_URL, process.env.ADMIN_URL, process.env.RIDER_URL].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if(!origin || allowedOrigins.includes(origin)){
            return callback(null, true);
        }

        return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

// IMPORTANT: Stripe webhook must receive the raw body.
// This route must be registered before express.json().
app.post("/api/payment/stripe/webhook", express.raw({ type: "application/json" }), stripeWebhook);
app.post("/api/subscription/stripe/webhook", express.raw({ type: "application/json" }), subscriptionStripeWebhook);

// Normal JSON middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Database connection
connectDB();

// API endpoints
app.use("/api/food", foodRouter);
app.use("/images", express.static("uploads"));
app.use("/api/user", userRouter);
app.use("/api/admin", adminRouter);
app.use("/api/rider", riderRouter);
app.use("/api/branch", branchRouter);
app.use("/api/message", messageRouter);
app.use("/api/rating", ratingRouter);
app.use("/api/order", orderRouter);
app.use("/api/payment", paymentRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/promo", promoRouter);
app.use("/api/location-confirmation", locationConfirmationRouter);
app.use("/api/delivery-otp", deliveryOtpRouter);
app.use("/api/cod-settlement", codSettlementRouter);
app.use("/api/rider-payout", riderPayoutRouter);
app.use("/api/subscription", subscriptionRouter);
app.use("/api/membership", membershipRouter);
app.use("/api/support-chat", supportChatRouter);

app.get("/", (req, res) => {
    res.send("API is Working");
});

const httpServer = createServer(app);

initializeSocket(httpServer);

httpServer.listen(port, () => {
    console.log(`Server Started on http://localhost:${port}`);
    console.log("Socket.IO Server Initialized");
});