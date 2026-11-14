import foodModel from "../models/foodModel.js";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";

// File Cleanup Help
const deleteFoodImage = async (filename) => {
    if(!filename){
        return;
    }

    try {
        await fs.promises.unlink(
            path.join("uploads", path.basename(filename))
        );
    } catch (error) {
        if(error.code !== "ENOENT"){
            console.error("Food Image Cleanup Error:", error);
        }
    }
};

// Ingredient Validation
const parseIngredients = (rawIngredients) => {
    let parsed;

    try {
        parsed = typeof rawIngredients === "string" ? JSON.parse(rawIngredients) : rawIngredients;
    } catch (error) {
        throw new Error("Invalid ingredients format.");
    }

    if(!Array.isArray(parsed) || parsed.length > 30 || parsed.some((item) => typeof item !== "string" || item.trim().length === 0 || item.trim().length > 100)){
        throw new Error("Please provide valid ingredients (maximum 30).");
    }

    // Remove duplicate ingredients
    return [
        ...new Map(
            parsed.map((item) => [
                item.trim().toLowerCase(),
                item.trim()
            ])
        ).values()
    ];
};

// Customization Validation
const parseCustomizationGroups = (rawGroups) => {
    let parsedGroups;

    try {
        parsedGroups = typeof rawGroups === "string" ? JSON.parse(rawGroups) : rawGroups;
    } catch (error) {
        throw new Error("Invalid customization groups format.");
    }

    if(!Array.isArray(parsedGroups)){
        throw new Error("Customization groups must be an array.");
    }

    // Maximum 15 groups per food
    if(parsedGroups.length > 15){
        throw new Error("Maximum 15 customization groups allowed.");
    }

    const groupNames = new Set();

    return parsedGroups.map((group, groupIndex) => {
        if(!group || typeof group !== "object" || Array.isArray(group)){
            throw new Error(`Invalid customization group at position ${groupIndex + 1}.`);
        }

        // Group Name
        if(typeof group.name !== "string" || !group.name.trim() || group.name.trim().length > 100){
            throw new Error(`Invalid customization group name at position ${groupIndex + 1}.`);
        }

        const groupName = group.name.trim();
        const groupKey = groupName.toLowerCase();

        if(groupNames.has(groupKey)){
            throw new Error(`Duplicate customization group: ${groupName}.`);
        }

        groupNames.add(groupKey);

        // Selection Type
        const selectionType = group.selectionType ?? "single";

        if(!["single", "multiple"].includes(selectionType)){
            throw new Error(`Invalid selection type for ${groupName}.`);
        }

        // Required
        const required = group.required ?? false;

        if(typeof required !== "boolean"){
            throw new Error(`Invalid required setting for ${groupName}.`);
        }

        // Selection Limits
        const minSelect = group.minSelect ?? (required ? 1 : 0);

        const maxSelect = group.maxSelect ?? 1;

        if(!Number.isInteger(minSelect) || !Number.isInteger(maxSelect) || minSelect < 0 || maxSelect < 1 || minSelect > maxSelect){
            throw new Error(`Invalid selection limits for ${groupName}.`);
        }

        if(selectionType === "single" && maxSelect !== 1){
            throw new Error(`${groupName}: Single selection groups must have maxSelect = 1.`);
        }

        if(required && minSelect < 1){
            throw new Error(`${groupName}: Required groups must have minSelect at least 1.`);
        }

        if(!required && minSelect !== 0){
            throw new Error(`${groupName}: Optional groups must have minSelect = 0.`);
        }

        // Options Validation
        if(!Array.isArray(group.options) || group.options.length === 0 || group.options.length > 30){
            throw new Error(`${groupName} must contain between 1 and 30 options.`);
        }

        if(maxSelect > group.options.length){
            throw new Error(`${groupName}: maxSelect cannot exceed the number of options.`);
        }

        const optionNames = new Set();

        const options = group.options.map((option, optionIndex) => {
            
            if(!option || typeof option !== "object" || Array.isArray(option)){
                throw new Error(`Invalid option in ${groupName} at position ${optionIndex + 1}.`);
            }

            // Option Name
            if(typeof option.name !== "string" || !option.name.trim() || option.name.trim().length > 100){
                throw new Error(`Invalid option name in ${groupName}.`);
            }

            const optionName = option.name.trim();
            const optionKey = optionName.toLowerCase();

            if(optionNames.has(optionKey)){
                throw new Error(`Duplicate option "${optionName}" in ${groupName}.`);
            }

            optionNames.add(optionKey);

            // Option Price
            const price = option.price ?? 0;

            if(typeof price !== "number" || !Number.isFinite(price) || price < 0 || !Number.isSafeInteger(Math.round(price * 100)) || Math.abs(price * 100 - Math.round(price * 100)) > 1e-7){
                throw new Error(`Invalid price for "${optionName}" in ${groupName}.`);
            }

            // Availability
            const isAvailable = option.isAvailable ?? true;

            if(typeof isAvailable !== "boolean"){
                throw new Error(`Invalid availability setting for "${optionName}".`);
            }

            const cleanOption = {
                name: optionName,
                price,
                isAvailable
            };

            // Preserve existing option ID on edit
            if(option._id !== undefined){
                if(typeof option._id !== "string" || !mongoose.isValidObjectId(option._id)){
                    throw new Error(`Invalid option ID in ${groupName}.`);
                }

                cleanOption._id = option._id;
            }

            return cleanOption;

        });

        const availableOptions = options.filter((option) => option.isAvailable).length;

        if(required && availableOptions < minSelect){
            throw new Error(`${groupName}: Not enough available options for the required selections.`);
        }

        const cleanGroup = {
            name: groupName,
            selectionType,
            required,
            minSelect,
            maxSelect,
            options
        };

        // Preserve existing group ID on edit
        if(group._id !== undefined){
            if(typeof group._id !== "string" || !mongoose.isValidObjectId(group._id)){
                throw new Error(`Invalid customization group ID for ${groupName}.`);
            }

            cleanGroup._id = group._id;
        }

        return cleanGroup;
    });
};

// Add Food
const addFood = async (req, res) => {
    try {
        if(!req.file){
            return res.status(400).json({
                success: false,
                message: "Please upload a food image."
            });
        }

        if(!["image/jpeg", "image/png", "image/webp"].includes(req.file.mimetype)){
            await deleteFoodImage(req.file.filename);

            return res.status(400).json({
                success: false,
                message: "Please upload a JPG, PNG or WebP image."
            });
        }

        const name = req.body.name?.trim();
        const description = req.body.description?.trim();
        const category = req.body.category?.trim();

        const price = Number(req.body.price);
        const preparationTime = req.body.preparationTime === undefined ? 15 : Number(req.body.preparationTime);

        if(!name || !description || !category){
            await deleteFoodImage(req.file.filename);

            return res.status(400).json({
                success: false,
                message: "Please complete all required food fields."
            });
        }

        if(req.body.price === undefined || String(req.body.price).trim() === "" || !Number.isFinite(price) || price <= 0){
            await deleteFoodImage(req.file.filename);

            return res.status(400).json({
                success: false,
                message: "Price must be greater than zero."
            });
        }

        if(String(req.body.preparationTime ?? "15").trim() === "" || !Number.isInteger(preparationTime) || preparationTime < 1){
            await deleteFoodImage(req.file.filename);

            return res.status(400).json({
                success: false,
                message: "Preparation time must be a positive whole number."
            });
        }

        // Parse ingredients
        const ingredients = req.body.ingredients !== undefined ? parseIngredients(req.body.ingredients) : [];

        // Parse customization groups
        const customizationGroups = req.body.customizationGroups !== undefined ? parseCustomizationGroups(req.body.customizationGroups) : [];

        // Create food
        const food = new foodModel({
            name,
            description,
            price,
            category,
            image: req.file.filename,
            preparationTime,
            ingredients,
            customizationGroups
        });

        await food.save();

        return res.status(201).json({
            success: true,
            message: "Food Added Successfully!",
            data: food
        });

    } catch (error) {
        console.error("Add Food Error:", error);

        await deleteFoodImage(req.file?.filename);

        if(error.name === "ValidationError" || error instanceof SyntaxError || (error instanceof Error && (error.message.startsWith("Invalid ")) || error.message.startsWith("Please ") || error.message.startsWith("Maximum ") || error.message.startsWith("Duplicate ") || error.message.includes("must ") || error.message.includes(": "))){
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        return res.status(500).json({
            success: false,
            message: "Error adding food."
        });
    }
};

// List Food
const listFood = async (req, res) => {
    try {
        const foods = await foodModel.find({});

        return res.json({
            success: true,
            data: foods
        });

    } catch (error) {
        console.error("List Food Error:", error);

        return res.status(500).json({
            success: false,
            message: "Error fetching foods."
        });
    }
};

// Remove Food
const removeFood = async (req, res) => {
    try {
        if(!mongoose.isValidObjectId(req.body.id)){
            return res.status(400).json({
                success: false,
                message: "Invalid food ID."
            });
        }

        const food = await foodModel.findById(req.body.id);

        if(!food){
            return res.status(404).json({
                success: false,
                message: "Food not found."
            });
        }

        // Delete database entry first
        await foodModel.findByIdAndDelete(req.body.id);

        // Cleanup image
        await deleteFoodImage(food.image);

        return res.json({
            success: true,
            message: "Food Removed Successfully!"
        });

    } catch (error) {
        console.error("Remove Food Error:", error);

        return res.status(500).json({
            success: false,
            message: "Error removing food."
        });
    }
};

// Update Food - Admin Only
const updateFood = async (req, res) => {
    try {
        const { id } = req.params;

        if(!mongoose.isValidObjectId(id)){
            await deleteFoodImage(req.file?.filename);

            return res.status(400).json({
                success: false,
                message: "Invalid product ID."
            });
        }

        const food = await foodModel.findById(id);

        if(!food){
            await deleteFoodImage(req.file?.filename);

            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        const {name, description, category, price, preparationTime} = req.body;

        // Product Name
        if(name !== undefined){
            if(typeof name !== "string" || !name.trim()){
                await deleteFoodImage(req.file?.filename);

                return res.status(400).json({
                    success: false,
                    message: "Please enter a valid product name."
                });
            }

            food.name = name.trim();
        }

        // Description
        if(description !== undefined){
            if(typeof description !== "string" || !description.trim()){
                await deleteFoodImage(req.file?.filename);

                return res.status(400).json({
                    success: false,
                    message: "Please enter a valid description."
                });
            }

            food.description = description.trim();
        }

        // Category
        if(category !== undefined){
            if(typeof category !== "string" || !category.trim()){
                await deleteFoodImage(req.file?.filename);

                return res.status(400).json({
                    success: false,
                    message: "Please select a valid category."
                });
            }

            food.category = category.trim();
        }

        // Price
        if(price !== undefined){
            const updatedPrice = Number(price);

            if(String(price).trim() === "" || !Number.isFinite(updatedPrice) || updatedPrice <= 0){
                await deleteFoodImage(req.file?.filename);

                return res.status(400).json({
                    success: false,
                    message: "Price must be greater than zero."
                });
            }

            food.price = updatedPrice;
        }

        // Preparation Time
        if(preparationTime !== undefined){
            const updatedTime = Number(preparationTime);

            if(String(preparationTime).trim() === "" || !Number.isInteger(updatedTime) || updatedTime < 1){
                await deleteFoodImage(req.file?.filename);

                return res.status(400).json({
                    success: false,
                    message: "Preparation time must be a positive whole number."
                });
            }

            food.preparationTime = updatedTime;
        }

        // Ingredients
        if(req.body.ingredients !== undefined){
            food.ingredients = parseIngredients(req.body.ingredients);
        }

        // Customization Groups
        // Existing groups are preserved if not provided
        if(req.body.customizationGroups !== undefined){
            food.customizationGroups = parseCustomizationGroups(req.body.customizationGroups);
        }

        // Optional Image Replacement
        const previousImage = food.image;

        if(req.file){
            if(!["image/jpeg", "image/png", "image/webp"].includes(req.file.mimetype)){
                await deleteFoodImage(req.file.filename);

                return res.status(400).json({
                    success: false,
                    message: "Please upload a JPG, PNG or WebP image."
                });
            }

            food.image = req.file.filename;
        }

        // Save updated product
        await food.save();

        // Remove old image after successful save
        if(req.file && previousImage && previousImage !== req.file.filename){
            await deleteFoodImage(previousImage);
        }

        return res.status(200).json({
            success: true,
            message: "Product updated successfully!",
            data: food
        });

    } catch (error) {
        console.error("Update Food Error:", error);

        await deleteFoodImage(req.file?.filename);

        if(error.name === "ValidationError" || error instanceof SyntaxError || (error instanceof Error && (error.message.startsWith("Invalid ") || error.message.startsWith("Please ") || error.message.startsWith("Maximum ") || error.message.startsWith("Duplicate ") || error.message.includes("must ") || error.message.includes(": ")))){
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        return res.status(500).json({
            success: false,
            message: "Error updating product."
        });
    }
};

export {addFood, listFood, removeFood, updateFood}