import mongoose from "mongoose";
import foodModel from "../models/foodModel.js";

const toCents = (value) => {
    const amount = Number(value);

    if(!Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(Math.round(amount * 100))){
        throw new Error("Invalid product or customization price.");
    }

    return Math.round(amount * 100);
};

const buildCustomizedCheckoutItems = async (customizedCartData = []) => {
    if(!Array.isArray(customizedCartData)){
        throw new Error("Invalid customized cart data.");
    }

    if(customizedCartData.length > 100){
        throw new Error("Customized cart item limit exceeded.");
    }

    const items = [];
    let subtotalCents = 0;

    for(const entry of customizedCartData){

        // Validate food and quantity
        if(!entry || !mongoose.isValidObjectId(entry.foodId)){
            throw new Error("Invalid customized cart food ID.");
        }

        const quantity = Number(entry.quantity);

        if(!Number.isInteger(quantity) || quantity < 1 || quantity > 20){
            throw new Error("Invalid customized cart quantity.");
        }

        // Always retrieve current product data
        const food = await foodModel.findById(entry.foodId);

        if(!food){
            throw new Error("A product in your customized cart no longer exists.");
        }

        const groups = food.customizationGroups || [];
        const rawSelections = entry.selections || [];

        if(!Array.isArray(rawSelections)){
            throw new Error("Invalid customized cart selections.");
        }

        const submitted = new Map();

        for(const selection of rawSelections){
            if(!selection || !mongoose.isValidObjectId(selection.groupId) || !Array.isArray(selection.optionIds)){
                throw new Error("Invalid customization selection.");
            }

            const groupId = String(selection.groupId);

            if(submitted.has(groupId)){
                throw new Error("Duplicate customization group.");
            }

            const optionIds = selection.optionIds.map((id) => String(id));

            if(optionIds.some((id) => !mongoose.isValidObjectId(id)) || new Set(optionIds).size !== optionIds.length){
                throw new Error("Invalid customization option IDs.");
            }

            submitted.set(groupId, optionIds);
        }

        let extraPriceCents = 0;
        const selectedCustomizations = [];

        for(const group of groups){
            const groupId = String(group._id);
            const selectedIds = submitted.get(groupId) || [];

            const minSelect = Number(group.minSelect ?? (group.required ? 1 : 0));

            const maxSelect = Number(group.maxSelect ?? 1);

            // Validate group selection rules
            if(selectedIds.length < minSelect || selectedIds.length > maxSelect || (group.selectionType === "single" && selectedIds.length > 1)){
                throw new Error(`Invalid selections for ${group.name}.`);
            }

            const selectedOptions = [];

            for(const optionId of selectedIds){
                const option = group.options.find((value) => String(value._id) === optionId);

                if(!option || option.isAvailable === false){
                    throw new Error(`Unavailable option in ${group.name}.`);
                }

                const optionPriceCents = toCents(option.price);

                extraPriceCents += optionPriceCents;

                selectedOptions.push({
                    optionId: option._id,
                    name: option.name,
                    price: optionPriceCents / 100
                });
            }

            if(selectedOptions.length > 0){
                selectedCustomizations.push({
                    groupId: group._id,
                    groupName: group.name,
                    options: selectedOptions
                });
            }

            submitted.delete(groupId);
        }

        // Reject groups removed from the product
        if(submitted.size > 0){
            throw new Error("A customization group is no longer available.");
        }

        const basePriceCents = toCents(food.price);

        const unitPriceCents = basePriceCents + extraPriceCents;

        const lineTotalCents = unitPriceCents * quantity;

        subtotalCents += lineTotalCents;

        if(!Number.isSafeInteger(subtotalCents) || !Number.isSafeInteger(lineTotalCents)){
            throw new Error("Customized cart total is too large.");
        }

        items.push({
            foodId: food._id,
            name: food.name,

            // Final unit price, including customizations
            price: unitPriceCents / 100,

            quantity,

            preparationTime: Math.max(1, Number(food.preparationTime) || 15),

            isCustomized: true,

            variantKey: String(entry.variantKey || ""),

            basePrice: basePriceCents / 100,

            // Preserve selected options in the order
            selectedCustomizations
        });
    }

    return {
        items,
        subtotal: subtotalCents / 100
    };
};

export default buildCustomizedCheckoutItems;