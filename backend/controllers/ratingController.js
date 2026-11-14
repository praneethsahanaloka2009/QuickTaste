import mongoose from "mongoose";
import ratingModel from "../models/ratingModel.js";
import foodModel from "../models/foodModel.js";

const validFoodId = (id) => mongoose.isValidObjectId(id);

// Add / Update Rating and optional comment
const addRating = async (req, res) => {
    try {
        const { foodId, rating, comment } = req.body;

        if(!validFoodId(foodId)){
            return res.status(400).json({
                success: false,
                message: "Valid Food ID is required!"
            });
        }

        if(!Number.isInteger(rating) || rating < 1 || rating > 5){
            return res.status(400).json({
                success: false,
                message: "Rating must be an integer from 1 to 5."
            });
        }

        if(comment !== undefined && (typeof comment !== "string" || comment.trim().length > 1000)){
            return res.status(400).json({
                success: false,
                message: "Review must contain at most 1000 characters."
            });
        }

        const foodExists = await foodModel.exists({ _id: foodId });

        if(!foodExists){
            return res.status(404).json({
                success: false,
                message: "Food item not found."
            });
        }

        const update = {
            rating: rating
        };

        // Preserve an existing comment when only stars are updated
        if(comment !== undefined){
            update.comment = comment.trim();
        }

        const savedRating = await ratingModel.findOneAndUpdate(
            {
                foodId,
                userId: req.userId
            },
            {
                $set: update,
                $setOnInsert: {
                    foodId,
                    userId: req.userId
                }
            },
            {
                upsert: true,
                returnDocument: "after",
                runValidators: true,
                setDefaultsOnInsert: true
            }
        );

        return res.status(200).json({
            success: true,
            message: "Rating saved successfully!",
            rating: savedRating
        });

    } catch (error) {
        console.error("Add Rating Error:", error);

        if(error.code === 11000){
            return res.status(409).json({
                success: false,
                message: "Rating was updated elsewhere. Please try again."
            });
        }

        return res.status(500).json({
            success: false,
            message: "Error saving rating."
        });
    }
};

// Get current user's rating and review
const getUserRating = async (req, res) => {
    try {
        const { foodId } = req.params;

        if(!validFoodId(foodId)){
            return res.status(400).json({
                success: false,
                message: "Invalid Food ID."
            });
        }

        const saved = await ratingModel.findOne({ foodId, userId: req.userId }).select("rating comment createdAt updatedAt");

        return res.status(200).json({
            success: true,

            // Preserve the existing StoreContext contract
            rating: saved ? saved.rating : 0,

            comment: saved?.comment || "",
            review: saved
        });

    } catch (error) {
        console.error("Get User Rating Error:", error);

        return res.status(500).json({
            success: false,
            message: "Error getting rating."
        });
    }
};

// Remove current user's rating and comment
const removeRating = async (req, res) => {
    try {
        const { foodId } = req.params;

        if(!validFoodId(foodId)){
            return res.status(400).json({
                success: false,
                message: "Invalid Food ID."
            });
        }

        await ratingModel.findOneAndDelete({
            foodId,
            userId: req.userId
        });

        return res.status(200).json({
            success: true,
            message: "Rating and review removed successfully!"
        });
        
    } catch (error) {
        console.error("Remove Rating Error:", error);

        return res.status(500).json({
            success: false,
            message: "Error removing rating."
        });
    }
};

// Save / Edit / Delete only the written comment
const saveReview = async (req, res) => {
    try {
        const { foodId, comment } = req.body;

        if(!validFoodId(foodId)){
            return res.status(400).json({
                success: false,
                message: "Invalid Food ID."
            });
        }

        if(typeof comment !== "string" || comment.trim().length > 1000){
            return res.status(400).json({
                success: false,
                message: "Review must contain at most 1000 characters."
            });
        }

        const cleanedComment = comment.trim();

        const existingRating = await ratingModel.findOne({
            foodId,
            userId: req.userId
        });

        if(!existingRating){
            return res.status(400).json({
                success: false,
                message: "Please rate this food before writing a review."
            });
        }

        existingRating.comment = cleanedComment;

        await existingRating.save();

        return res.status(200).json({
            success: true,
            message: cleanedComment ? "Review saved successfully!" : "Review comment removed successfully!",
            review: existingRating
        });

    } catch (error) {
        console.error("Save Review Error:", error);

        return res.status(500).json({
            success: false,
            message: "Error saving review."
        });
    }
};

// Public: Get food ratings summary and written reviews
const getFoodReviews = async (req, res) => {
    try {
        const { foodId } = req.params;

        if(!validFoodId(foodId)){
            return res.status(400).json({
                success: false,
                message: "Invalid Food ID."
            });
        }

        const foodExists = await foodModel.exists({
            _id: foodId
        });

        if(!foodExists){
            return res.status(404).json({
                success: false,
                message: "Food item not found."
            });
        }

        const foodObjectId = new mongoose.Types.ObjectId(foodId);

        // Average includes star-only ratings
        const summary = await ratingModel.aggregate([
            {
                $match: {
                    foodId: foodObjectId
                }
            },
            {
                $group: {
                    _id: null,
                    averageRating: {
                        $avg: "$rating"
                    },
                    totalRatings: {
                        $sum: 1
                    }
                }
            }
        ]);

        // Only show ratings that have written comments
        const reviewFilter = {
            foodId: foodObjectId,
            comment: {
                $type: "string",
                $ne: ""
            }
        };

        const [reviews, totalReviews] = await Promise.all([
            ratingModel.find(reviewFilter).select("rating comment userId createdAt updatedAt").populate("userId", "name avatar").sort({ createdAt: -1 }).limit(20).lean(),
            ratingModel.countDocuments(reviewFilter)
        ]);

        const safeReviews = reviews.map((item) => ({
            _id: item._id,
            rating: item.rating,
            comment: item.comment,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            user: {
                name: item.userId?.name || "Customer",
                avatar: item.userId?.avatar || ""
            }
        }));

        return res.status(200).json({
            success: true,
            averageRating: summary.length ? Number(summary[0].averageRating.toFixed(1)) : 0,
            totalRatings: summary.length ? summary[0].totalRatings : 0,
            totalReviews,
            reviews: safeReviews
        });

    } catch (error) {
        console.error("Get Food Reviews Error:", error);

        return res.status(500).json({
            success: false,
            message: "Error fetching food reviews."
        });
    }
};

export {addRating, getUserRating, removeRating, saveReview, getFoodReviews}