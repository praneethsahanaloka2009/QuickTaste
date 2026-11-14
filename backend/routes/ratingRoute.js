import express from "express";
import { addRating, getFoodReviews, getUserRating, removeRating, saveReview } from "../controllers/ratingController.js";
import authMiddleware from "../middleware/auth.js";
const ratingRouter = express.Router();

// Public: Food rating summary and written reviews
ratingRouter.get("/food/:foodId", getFoodReviews);

// Customer: Add or update star rating
ratingRouter.post("/add", authMiddleware, addRating);

// Customer: Get own rating and written review
ratingRouter.get("/user/:foodId", authMiddleware, getUserRating);

// Customer: Save, edit or clear written review
ratingRouter.put("/review", authMiddleware, saveReview);

// Customer: Remove own rating and comment
ratingRouter.delete("/remove/:foodId", authMiddleware, removeRating);

export default ratingRouter;