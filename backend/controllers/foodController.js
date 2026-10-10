import foodModel from "../models/foodModel.js";
import fs from "fs";

// Add food item
const addFood = async (req, res) => {

    try {
        
        if(!req.file){
            return res.status(400).json({
                success: false,
                message: "Please upload a food image."
            });
        }

        const image_filename = req.file.filename;

        const food = new foodModel({
            name: req.body.name,
            description: req.body.description,
            price: Number(req.body.price),
            category: req.body.category,
            image: image_filename,
            preparationTime: Number(req.body.preparationTime) || 15
        });

        await food.save();

        res.json({
            success: true,
            message: "Food Added Successfully!"
        });

    } catch (error) {
        
        console.log("Add Food Error:", error);

        res.status(500).json({
            success: false,
            message: "Error adding food."
        });

    }

};

// All food list
const listFood = async (req, res) => {

    try {
        
        const foods = await foodModel.find({});

        res.json({
            success: true,
            data: foods
        });

    } catch (error) {
        
        console.log(error);

        res.status(500).json({
            success: false,
            message: "Error fetching foods."
        });

    }

};

// Remove food item
const removeFood = async (req, res) => {
    
    try {
        
        const food = await foodModel.findById(req.body.id);

        if(!food){
            return res.status(404).json({
                success: false,
                message: "Food not found."
            });
        }

        fs.unlink(`uploads/${food.image}`, () => {});

        await foodModel.findByIdAndDelete(req.body.id);

        res.json({
            success: true,
            message: "Food Removed Successfully!"
        })

    } catch (error) {
        
        console.log(error);

        res.status(500).json({
            success: false,
            message: "Error removing food."
        });

    }

}

export { addFood, listFood, removeFood };