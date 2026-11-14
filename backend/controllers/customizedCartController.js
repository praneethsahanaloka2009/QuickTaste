import mongoose from "mongoose";
import userModel from "../models/userModel.js";
import foodModel from "../models/foodModel.js";

// Validate and normalize selections against database options
const validateSelections = (food, rawSelections) => {
    
    if(!Array.isArray(rawSelections)){
        throw new Error("Selections must be an array.");
    }

    const groups = food.customizationGroups || [];

    if(rawSelections.length > groups.length){
        throw new Error("Invalid customization selections.");
    }

    const submitted = new Map();

    for(const selection of rawSelections){
        if(!selection || typeof selection !== "object" || Array.isArray(selection) || typeof selection.groupId !== "string" || !Array.isArray(selection.optionIds)){
            throw new Error("Invalid selection format.");
        }

        const groupId = selection.groupId;

        if(!mongoose.isValidObjectId(groupId) || submitted.has(groupId)){
            throw new Error("Invalid or duplicate group selection.");
        }

        if(selection.optionIds.some((id) => typeof id !== "string" || !mongoose.isValidObjectId(id))){
            throw new Error("Invalid option ID.");
        }

        submitted.set(groupId, selection.optionIds);
    }

    let extraPriceCents = 0;
    const normalized = [];

    for(const group of groups){
        const groupId = String(group._id);
        const selectedIds = submitted.get(groupId) || [];

        const uniqueIds = [...new Set(selectedIds)];

        if(uniqueIds.length !== selectedIds.length){
            throw new Error(`Duplicate options in ${group.name}.`);
        }

        const minSelect = Number(group.minSelect ?? (group.required ? 1 : 0));

        const maxSelect = Number(group.maxSelect ?? 1);

        if(uniqueIds.length < minSelect || uniqueIds.length > maxSelect || (group.selectionType === "single" && uniqueIds.length > 1)){
            throw new Error(`Invalid selections for ${group.name}.`);
        }

        const validOptions = [];

        for(const optionId of uniqueIds){
            const option = group.options.find((item) => String(item._id) === optionId);

            if(!option || option.isAvailable === false){
                throw new Error(`Unavailable option selected in ${group.name}.`);
            }

            validOptions.push(option);

            extraPriceCents += Math.round(Number(option.price) * 100);
        }

        if(uniqueIds.length > 0){
            normalized.push({
                groupId,
                optionIds: uniqueIds.sort()
            });
        }
    }

    // Reject group IDs that don't belong to this product
    const knownGroupIds = new Set(
        groups.map((group) => String(group._id))
    );

    for(const groupId of submitted.keys()){
        if(!knownGroupIds.has(groupId)){
            throw new Error("A selected customization group does not exist.");
        }
    }

    normalized.sort((a, b) => a.groupId.localeCompare(b.groupId));

    return {
        selections: normalized,
        extraPriceCents
    };

};

// Add customized variant to the cart
const addCustomizedToCart = async (req, res) => {
    try {
        const { foodId, quantity = 1, selections = [] } = req.body || {};

        if(typeof foodId !== "string" || !mongoose.isValidObjectId(foodId)){
            return res.status(400).json({
                success: false,
                message: "Valid food ID is required."
            });
        }

        if(!Number.isInteger(quantity) || quantity < 1 || quantity > 20){
            return res.status(400).json({
                success: false,
                message: "Quantity must be between 1 and 20."
            });
        }

        const food = await foodModel.findById(foodId);

        if(!food){
            return res.status(404).json({
                success: false,
                message: "Food not found."
            });
        }

        const validated = validateSelections(food, selections);

        const user = await userModel.findById(req.userId);

        if(!user){
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const cart = Array.isArray(user.customizedCartData) ? [...user.customizedCartData] : [];

        // Same food + same selections = same cart variant
        const variantKey = JSON.stringify({
            foodId: String(food._id),
            selections: validated.selections
        });

        const existingIndex = cart.findIndex((item) => item.variantKey === variantKey);

        if(existingIndex >= 0){
            const newQuantity = Number(cart[existingIndex].quantity) + quantity;

            if(newQuantity > 20){
                return res.status(400).json({
                    success: false,
                    message: "Maximum 20 items per variant."
                });
            }

            cart[existingIndex] = {
                ...cart[existingIndex],
                quantity: newQuantity
            };
        } else {
            if(cart.length >= 100){
                return res.status(400).json({
                    success: false,
                    message: "Cart item limit reached."
                });
            }

            cart.push({
                variantKey,
                foodId: String(food._id),
                quantity,
                selections: validated.selections
            });
        }

        user.customizedCartData = cart;
        user.markModified("customizedCartData");

        await user.save();

        return res.status(200).json({
            success: true,
            message: "Customized food added to cart!",
            customizedCartData: user.customizedCartData
        });

    } catch (error) {
        console.error("Add Customized Cart Error:", error);

        if(error instanceof Error && (error.message.startsWith("Invalid") || error.message.startsWith("Selections") || error.message.startsWith("Duplicate") || error.message.startsWith("Unavailable") || error.message.startsWith("A selected") || error.message.startsWith("Maximum") || error.message.startsWith("Cart item"))){
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        return res.status(500).json({
            success: false,
            message: "Unable to add customized food."
        });
    }
};

// Get customized cart items with current product prices
const getCustomizedCart = async (req, res) => {
    try {
        const user = await userModel.findById(req.userId).select("customizedCartData");

        if(!user){
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const items = [];

        for(const entry of user.customizedCartData || []){
            const food = await foodModel.findById(entry.foodId);

            if(!food){
                items.push({
                    ...entry,
                    available: false
                });
                continue;
            }

            try {
                const validated = validateSelections(food, entry.selections || []);

                const unitPriceCents = Math.round(Number(food.price) * 100) + validated.extraPriceCents;

                const selectedDetails = validated.selections.map((selection) => {
                    const group = food.customizationGroups.find((item) => String(item._id) === selection.groupId);

                    return {
                        groupId: selection.groupId,
                        groupName: group.name,
                        options: selection.optionIds.map((optionId) => {
                            const option = group.options.find((item) => String(item._id) === optionId);

                            return {
                                optionId,
                                name: option.name,
                                price: Number(option.price)
                            };
                        })
                    };
                });

                items.push({
                    ...entry,
                    name: food.name,
                    image: food.image,
                    selectedDetails,
                    unitPrice: unitPriceCents / 100,
                    lineTotal: (unitPriceCents * entry.quantity) / 100,
                    available: true
                });
                
            } catch (error) {
                items.push({
                    ...entry,
                    name: food.name,
                    image: food.image,
                    available: false
                });
            }
        }

        return res.status(200).json({
            success: true,
            items
        });

    } catch (error) {
        console.error("Get Customized Cart Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to load customized cart."
        });
    }
};

// Remove one quantity or remove a variant completely
const removeCustomizedFromCart = async (req, res) => {
    try {
        const { variantKey, removeAll = false } = req.body || {};

        if(typeof variantKey !== "string" || !variantKey.trim() || variantKey.length > 10000){
            return res.status(400).json({
                success: false,
                message: "Valid cart variant is required."
            });
        }

        if(typeof removeAll !== "boolean"){
            return res.status(400).json({
                success: false,
                message: "Invalid removeAll value."
            });
        }

        const user = await userModel.findById(req.userId);

        if(!user){
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const cart = [...(user.customizedCartData || [])];

        const index = cart.findIndex((item) => item.variantKey === variantKey);

        if(index === -1){
            return res.status(404).json({
                success: false,
                message: "Cart item not found."
            });
        }

        if(removeAll || cart[index].quantity <= 1){
            cart.splice(index, 1);
        } else {
            cart[index] = {
                ...cart[index],
                quantity: cart[index].quantity - 1
            };
        }

        user.customizedCartData = cart;
        user.markModified("customizedCartData");

        await user.save();

        return res.status(200).json({
            success: true,
            message: "Cart updated successfully!",
            customizedCartData: cart
        });

    } catch (error) {
        console.error("Remove Customized Cart Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to update customized cart."
        });
    }
};

export {addCustomizedToCart, getCustomizedCart, removeCustomizedFromCart};