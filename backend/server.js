import 'dotenv/config'
import express from "express"
import cors from "cors"
import { connectDB } from "./config/DB.js"
import foodRouter from "./routes/foodRoute.js"
import userRouter from "./routes/userRoute.js"
import adminRouter from "./routes/adminRoute.js"
import messageRouter from "./routes/messageRoute.js"
import ratingRouter from "./routes/ratingRoute.js"
import orderRouter from "./routes/orderRoute.js"
import paymentRouter from "./routes/paymentRoute.js";
import dashboardRouter from "./routes/dashboardRoute.js";
import promoRouter from "./routes/promoRoute.js"

// app config
const app = express()
const port = 4911

// middleware
app.use(express.json())
app.use(cors())

// DB Connection
connectDB();

// api endpoints
app.use("/api/food", foodRouter)
app.use("/images", express.static('uploads'))
app.use("/api/user", userRouter)
app.use("/api/admin", adminRouter)
app.use("/api/message", messageRouter)
app.use("/api/rating", ratingRouter)
app.use("/api/order", orderRouter)
app.use("/api/payment", paymentRouter)
app.use("/api/dashboard", dashboardRouter);
app.use("/api/promo", promoRouter)

app.get("/",(req,res) => {
    res.send("API is Working")
})

app.listen(port,() => {
    console.log(`Server Started on http://localhost:${port}`)
})