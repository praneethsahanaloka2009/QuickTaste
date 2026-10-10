import ratingModel from '../models/ratingModel.js'

// Add / Update Rating
const addRating = async (req, res) => {

    try {
        const { foodId, rating } = req.body;

        if(!foodId || !rating){
            return res.status(400).json({
                success : false,
                message : "Food ID and rating are required!"
            });
        }

        if(rating < 1 || rating > 5){
            return res.status(400).json({
                success : false,
                message : "Rating must be between 1 and 5."
            });
        }

        const existingRating = await ratingModel.findOne({
            foodId : foodId,
            userId : req.userId
        });

        if(existingRating){

            existingRating.rating = rating;

            await existingRating.save();

            return res.status(200).json({
                success : true,
                message : "Rating updated successfully!",
                rating : existingRating
            });

        }

        const newRating = new ratingModel({
            foodId : foodId,
            userId : req.userId,
            rating : rating
        });

        await newRating.save();

        res.status(201).json({
            success : true,
            message : "Rating added successfully!",
            rating : newRating
        });
        
    } catch (error) {
        
        console.log("Add Rating Error:", error);

        res.status(500).json({
            success : false,
            message : "Error adding rating"
        });

    }

};

// Get User Rating For A Food
const getUserRating = async (req, res) => {

    try {
        const { foodId } = req.params;

        if(!foodId){
            return res.status(400).json({
                success : false,
                message : "Food ID is required!"
            });
        }

        const rating = await ratingModel.findOne({
            foodId : foodId,
            userId : req.userId
        });

        res.status(200).json({
            success : true,
            rating : rating ? rating.rating : 0
        });

    } catch (error) {
        
        console.log("Get User Rating Error:", error);

        res.status(500).json({
            success : false,
            message : "Error getting rating"
        });

    }

}

// Remove User Rating
const removeRating = async (req, res) => {

    try {
        const { foodId } = req.params;

        if(!foodId){
            return res.status(400).json({
                success : false,
                message : "Food ID is required!"
            });
        }

        await ratingModel.findOneAndDelete({
            foodId : foodId,
            userId : req.userId
        });

        res.status(200).json({
            success : true,
            message : "Rating removed successfully!"
        });

    } catch (error) {
        
        console.log("Remove Rating Error:", error);

        res.status(500).json({
            success : false,
            message : "Error removing rating"
        });

    }

}

export { addRating, getUserRating, removeRating };