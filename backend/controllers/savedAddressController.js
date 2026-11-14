import mongoose from "mongoose";
import userModel from "../models/userModel.js";

const MAX_ADDRESSES = 5;

const formatAddresses = (user) => {
    return user.savedAddresses || [];
};

// Validate and normalize address data
const validateAddress = (body) => {
    const { label, fullAddress, city, state = "", zipCode = "", country = "Sri Lanka", latitude, longitude } = body || {};

    if(!["Home", "Work", "Other"].includes(label)){
        throw new Error("Please select a valid address label.");
    }

    const fields = { fullAddress, city, state, zipCode, country };

    for(const [key, value] of Object.entries(fields)){
        if(typeof value !== "string"){
            throw new Error(`Invalid ${key}.`);
        }

        if(value.trim().length > 250){
            throw new Error(`${key} is too long.`);
        }
    }

    if(!fullAddress.trim() || !city.trim() || !country.trim()){
        throw new Error("Full address, city and country are required.");
    }

    if(typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180){
        throw new Error("Please select a valid location on the map.");
    }

    return {
        label,
        fullAddress: fullAddress.trim(),
        city: city.trim(),
        state: state.trim(),
        zipCode: zipCode.trim(),
        country: country.trim(),
        latitude,
        longitude
    };
};

// GET - Customer's saved addresses
export const getSavedAddresses = async (req, res) => {
    try {
        const user = await userModel.findById(req.userId).select("savedAddresses");

        if(!user){
            return res.status(404).json({
                success: false,
                message: "Customer not found."
            });
        }

        return res.status(200).json({
            success: true,
            addresses: formatAddresses(user)
        });
    } catch (error) {
        console.error("Get Saved Addresses Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to load saved addresses."
        });
    }
};

// POST - Add new address
export const addSavedAddress = async (req, res) => {
    try {
        const addressData = validateAddress(req.body);

        const user = await userModel.findById(req.userId);

        if(!user){
            return res.status(404).json({
                success: false,
                message: "Customer not found."
            });
        }

        if(user.savedAddresses.length >= MAX_ADDRESSES){
            return res.status(400).json({
                success: false,
                message: "You can save up to 5 addresses."
            });
        }

        const isFirstAddress = user.savedAddresses.length === 0;

        const makeDefault = isFirstAddress || req.body.isDefault === true;

        if(makeDefault){
            user.savedAddresses.forEach((address) => {
                address.isDefault = false;
            });
        }

        user.savedAddresses.push({
            ...addressData,
            isDefault: makeDefault
        });

        await user.save();

        return res.status(201).json({
            success: true,
            message: "Delivery address saved successfully!",
            addresses: formatAddresses(user)
        });
    } catch (error) {
        console.error("Add Saved Address Error:", error);

        if(error.name === "ValidationError" || error.message.startsWith("Please") || error.message.startsWith("Invalid") || error.message.endsWith("is too long.") || error.message.includes("are required")){
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        return res.status(500).json({
            success: false,
            message: "Unable to save delivery address."
        });
    }
};

// PUT - Update an existing address
export const updateSavedAddress = async (req, res) => {
    try {
        const { addressId } = req.params;

        if(!mongoose.isValidObjectId(addressId)){
            return res.status(400).json({
                success: false,
                message: "Invalid address ID."
            });
        }

        const addressData = validateAddress(req.body);

        const user = await userModel.findById(req.userId);

        if(!user){
            return res.status(404).json({
                success: false,
                message: "Customer not found."
            });
        }

        const address = user.savedAddresses.id(addressId);

        if(!address){
            return res.status(404).json({
                success: false,
                message: "Saved address not found."
            });
        }

        address.set(addressData);

        if(req.body.isDefault === true){
            user.savedAddresses.forEach((item) => {
                item.isDefault = item._id.toString() === addressId;
            });
        }

        await user.save();

        return res.status(200).json({
            success: true,
            message: "Delivery address updated successfully!",
            addresses: formatAddresses(user)
        });
    } catch (error) {
        console.error("Update Saved Address Error:", error);

        if(error.name === "ValidationError" || error.message.startsWith("Please") || error.message.startsWith("Invalid") || error.message.endsWith("is too long.") || error.message.includes("are required")){
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        return res.status(500).json({
            success: false,
            message: "Unable to update delivery address."
        });
    }
};

// PUT - Set a default address
export const setDefaultAddress = async (req, res) => {
    try {
        const { addressId } = req.params;

        if(!mongoose.isValidObjectId(addressId)){
            return res.status(400).json({
                success: false,
                message: "Invalid address ID."
            });
        }

        const user = await userModel.findById(req.userId);

        if(!user){
            return res.status(404).json({
                success: false,
                message: "Customer not found."
            });
        }

        const selectedAddress = user.savedAddresses.id(addressId);

        if(!selectedAddress){
            return res.status(404).json({
                success: false,
                message: "Saved address not found."
            });
        }

        user.savedAddresses.forEach((address) => {
            address.isDefault = address._id.toString() === addressId;
        });

        await user.save();

        return res.status(200).json({
            success: true,
            message: "Default delivery address updated!",
            addresses: formatAddresses(user)
        });
    } catch (error) {
        console.error("Set Default Address Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to set default address."
        });
    }
};

// DELETE - Remove an address
export const deleteSavedAddress = async (req, res) => {
    try {
        const { addressId } = req.params;

        if(!mongoose.isValidObjectId(addressId)){
            return res.status(400).json({
                success: false,
                message: "Invalid address ID."
            });
        }

        const user = await userModel.findById(req.userId);

        if(!user){
            return res.status(404).json({
                success: false,
                message: "Customer not found."
            });
        }

        const address = user.savedAddresses.id(addressId);

        if(!address){
            return res.status(404).json({
                success: false,
                message: "Saved address not found."
            });
        }

        const wasDefault = address.isDefault;

        user.savedAddresses.pull({ _id: address._id });

        if(user.savedAddresses.length > 0 && (wasDefault || !user.savedAddresses.some((item) => item.isDefault === true))){
            user.savedAddresses.forEach((item, index) => {
                item.isDefault = index === 0;
            });
        }

        await user.save();

        return res.status(200).json({
            success: true,
            message: "Saved address removed successfully!",
            addresses: formatAddresses(user)
        });
    } catch (error) {
        console.error("Delete Saved Address Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to remove saved address."
        });
    }
};