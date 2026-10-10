import express from "express";
import { addRating, getUserRating, removeRating } from "../controllers/ratingController.js";
import authMiddleware from "../middleware/auth.js";

const ratingRouter = express.Router();

// Add/Update Rating
ratingRouter.post("/add", authMiddleware, addRating);

// Get User Rating
ratingRouter.get("/user/:foodId", authMiddleware, getUserRating);

// Remove User Rating
ratingRouter.delete("/remove/:foodId", authMiddleware, removeRating);

export default ratingRouter;