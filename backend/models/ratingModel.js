import mongoose from "mongoose";

const ratingSchema = new mongoose.Schema({

    foodId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "food",
        required : true
    },

    userId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "user",
        required : true
    },

    rating : {
        type : Number,
        required : true,
        min : 1,
        max : 5
    },

    comment : {
        type : String,
        trim : true,
        maxlength : 1000,
        default : ""
    }

},{
    timestamps : true
});

// One rating/review per customer per food item
ratingSchema.index(
    {
        foodId : 1,
        userId : 1
    },
    {
        unique : true
    }
);

const ratingModel = mongoose.models.rating || mongoose.model("rating", ratingSchema);

export default ratingModel;