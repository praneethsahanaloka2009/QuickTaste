import mongoose from "mongoose";
import branchModel from "../models/branchModel.js";
import orderModel from "../models/orderModel.js";
import { selectBestBranch } from "../utils/branchSelection.js";

// Helper: Normalize branch code
const normalizeCode = (code) => {
    return String(code || "").trim().toUpperCase();
}

// Helper: Check valid MongoDB ObjectId
const isValidId = (id) => {
    return mongoose.isValidObjectId(id);
}

// Helper: Validate GPS coordinates
const validateLocation = (location) => {
    if(location === null || typeof location !== "object" || Array.isArray(location)){
        return "Invalid branch location.";
    }

    const latitude = location.latitude;
    const longitude = location.longitude;

    const hasLatitude = latitude !== null && latitude !== undefined && latitude !== "";
    const hasLongitude = longitude !== null && longitude !== undefined && longitude !== "";

    // Both coordinates must be supplied together.
    if(hasLatitude !== hasLongitude){
        return "Latitude and longitude must be provided together.";
    }

    if(hasLatitude && hasLongitude){
        if(typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180){
            return "Invalid latitude or longitude.";
        }
    }

    return null;
};

// Helper: Validate branch status and activation
const validateBranchStatus = (branch) => {
    if(branch.isActive === true && branch.status !== "Operational"){
        return "Only operational branches can be active.";
    }

    if(branch.isActive === true){
        if(typeof branch.address !== "string" || !branch.address.trim() || !branch.location || !Number.isFinite(branch.location.latitude) || !Number.isFinite(branch.location.longitude)){
            return "An active branch requires an address and valid GPS coordinates.";
        }
    }

    return null;
}

// Helper: Handle controller errors
const handleBranchError = (error, res) => {
    console.error("Branch Controller Error:", error);

    if(error.code === 11000){
        return res.status(409).json({
            success: false,
            message: "A branch with this code already exists."
        });
    }

    if(error.name === "ValidationError"){
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }

    return res.status(500).json({
        success: false,
        message: "Internal server error."
    });
};

// Create branch - Admin
const createBranch = async (req, res) => {
    try {
        const {name, code, province, city, address = "", phone = "", email = "", location, deliveryRadiusKm = 10, isActive = false, status = "Planned"} = req.body;

        if(typeof name !== "string" || !name.trim() || typeof code !== "string" || !code.trim() || typeof province !== "string" || !province.trim() || typeof city !== "string" || !city.trim()){
            return res.status(400).json({
                success: false,
                message: "Branch name, code, province and city are required."
            });
        }

        const branchCode = normalizeCode(code);

        const existingBranch = await branchModel.findOne({
            code: branchCode
        });

        if(existingBranch){
            return res.status(409).json({
                success: false,
                message: "A branch with this code already exists."
            });
        }
        
        const branchLocation = location ?? {
            latitude: null,
            longitude: null
        };

        const locationError = validateLocation(branchLocation);

        if(locationError){
            return res.status(400).json({
                success: false,
                message: locationError
            });
        }

        const branchData = {
            name: name.trim(),
            code: branchCode,
            province: province.trim(),
            city: city.trim(),
            address,
            phone,
            email,
            location: branchLocation,
            deliveryRadiusKm,
            isActive,
            status
        };

        const statusError = validateBranchStatus(branchData);

        if(statusError){
            return res.status(400).json({
                success: false,
                message: statusError
            });
        }

        const branch = await branchModel.create(branchData);

        return res.status(201).json({
            success: true,
            message: "Branch created successfully.",
            branch
        });
    } catch (error) {
        return handleBranchError(error, res);
    }
};

// Get all branches - Admin
const getAllBranches = async (req, res) => {
    try {
        const { status, province, city, search } = req.query;

        const filter = {};

        if(status){
            filter.status = status;
        }

        if(province){
            filter.province = province;
        }

        if(city){
            filter.city = city;
        }

        if(search && typeof search === "string"){
            const escapedSearch = search.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            );

            filter.$or = [
                {
                    name: {
                        $regex: escapedSearch,
                        $options: "i"
                    }
                },
                {
                    code: {
                        $regex: escapedSearch,
                        $options: "i"
                    }
                },
                {
                    city: {
                        $regex: escapedSearch,
                        $options: "i"
                    }
                },
                {
                    province: {
                        $regex: escapedSearch,
                        $options: "i"
                    }
                }
            ];
        }

        const branches = await branchModel.find(filter).sort({province: 1, city: 1, name: 1});

        return res.status(200).json({
            success: true,
            count: branches.length,
            branches
        });
    } catch (error) {
        return handleBranchError(error, res);
    }
}

// Get active branches - Public
const getActiveBranches = async (req, res) => {
    try {
        const branches = await branchModel.find({isActive: true, status: "Operational"}).select("name code province city address location deliveryRadiusKm").sort({province: 1, city: 1, name: 1});

        return res.status(200).json({
            success: true,
            count: branches.length,
            branches
        });
    } catch (error) {
        return handleBranchError(error, res);
    }
}

// Get single branch - Admin
const getBranchById = async (req, res) => {
    try {
        const { id } = req.params;

        if(!isValidId(id)){
            return res.status(400).json({
                success: false,
                message: "Invalid branch ID."
            });
        }

        const branch = await branchModel.findById(id);

        if(!branch){
            return res.status(404).json({
                success: false,
                message: "Branch not found."
            });
        }

        return res.status(200).json({
            success: true,
            branch
        });
    } catch (error) {
        return handleBranchError(error, res);
    }
};

// Update branch - Admin
const updateBranch = async (req, res) => {
    try {
        const { id } = req.params;

        if(!isValidId(id)){
            return res.status(400).json({
                success: false,
                message: "Invalid branch ID."
            });
        }

        const branch = await branchModel.findById(id);

        if(!branch){
            return res.status(404).json({
                success: false,
                message: "Branch not found."
            });
        }

        const allowedFields = ["name", "province", "city", "address", "phone", "email", "deliveryRadiusKm", "status", "isActive"];

        for(const field of allowedFields){
            if(Object.prototype.hasOwnProperty.call(req.body, field)){
                branch[field] = req.body[field];
            }
        }

        // Keep branch code immutable to preserve references.
        if(Object.prototype.hasOwnProperty.call(req.body, "code")){
            return res.status(400).json({
                success: false,
                message: "Branch code cannot be changed."
            });
        }

        if(Object.prototype.hasOwnProperty.call(req.body, "location")){
            const locationError = validateLocation(req.body.location);

            if(locationError){
                return res.status(400).json({
                    success: false,
                    message: locationError
                });
            }

            branch.location = req.body.location;
        }

        // Automatically deactivate a branch when it stops operating.
        if(branch.status !== "Operational"){
            branch.isActive = false;
        }

        const statusError = validateBranchStatus(branch);

        if(statusError){
            return res.status(400).json({
                success: false,
                message: statusError
            });
        }

        await branch.save();

        return res.status(200).json({
            success: true,
            message: "Branch updated successfully.",
            branch
        });
    } catch (error) {
        return handleBranchError(error, res);
    }
};

// Deactivate branch - Admin
// Soft deactivation: existing orders and history remain intact.
const deactivateBranch = async (req, res) => {
    try {
        const { id } = req.params;

        if(!isValidId(id)){
            return res.status(400).json({
                success: false,
                message: "Invalid branch ID."
            });
        }

        const branch = await branchModel.findById(id);

        if(!branch){
            return res.status(404).json({
                success: false,
                message: "Branch not found."
            });
        }

        branch.isActive = false;
        branch.status = "Temporarily Closed";

        await branch.save();

        return res.status(200).json({
            success: true,
            message: "Branch deactivated successfully.",
            branch
        });
    } catch (error) {
        return handleBranchError(error, res);
    }
};

// Delete Branch - Admin
const deleteBranch = async (req, res) => {
    try {
        const { id } = req.params;

        if(!isValidId(id)){
            return res.status(400).json({
                success: false,
                message: "Invalid branch ID."
            });
        }

        const branch = await branchModel.findById(id);

        if(!branch){
            return res.status(404).json({
                success: false,
                message: "Branch not found."
            });
        }

        // Prevent deletion if orders reference this branch
        const existingOrder = await orderModel.exists({
            branchId: branch._id
        });

        if(existingOrder){
            return res.status(409).json({
                success: false,
                message: "This branch has existing orders and cannot be deleted. Please deactivate it instead."
            });
        }

        await branchModel.deleteOne({
            _id: branch._id
        });

        return res.status(200).json({
            success: true,
            message: "Branch deleted successfully."
        });
        
    } catch (error) {
        return handleBranchError(error, res);
    }
};

// Check Delivery Coverage - Public
const checkDeliveryCoverage = async (req, res) => {
    try {
        const { deliveryLocation } = req.body || {};

        // Validate customer GPS coordinates
        if(!deliveryLocation || typeof deliveryLocation !== "object" || Array.isArray(deliveryLocation) || typeof deliveryLocation.latitude !== "number" || typeof deliveryLocation.longitude !== "number" || !Number.isFinite(deliveryLocation.latitude) || !Number.isFinite(deliveryLocation.longitude) || deliveryLocation.latitude < -90 || deliveryLocation.latitude > 90 || deliveryLocation.longitude < -180 || deliveryLocation.longitude > 180){
            return res.status(400).json({
                success: false,
                available: false,
                message: "Please select a valid delivery location."
            });
        }

        // Reuse existing branch selection logic
        try {
            const selection = await selectBestBranch(deliveryLocation);

            const branch = selection.selectedBranch;

            return res.status(200).json({
                success: true,
                available: true,
                message: "Delivery is available at this location.",
                branch: {
                    id: branch.branchId,
                    name: branch.name,
                    code: branch.code,
                    city: branch.city,
                    deliveryRadiusKm: branch.coverageKm
                },
                deliveryDistanceKm: branch.distanceKm,
                estimatedTravelMinutes: branch.durationMinutes
            });

        } catch (error) {
            // Location is outside all operational branches
            if(error.message === "Delivery is not available at this location."){
                return res.status(200).json({
                    success: true,
                    available: false,
                    message: "Delivery is not available at this location."
                });
            }

            // No operational branches
            if(error.message === "No operational branches available."){
                return res.status(200).json({
                    success: true,
                    available: false,
                    message: "Delivery is currently unavailable."
                });
            }

            // Routing or infrastructure errors must not be mistaken for a confirmed out-of-coverage result.
            throw error;
        }
    } catch (error) {
        console.error("Check Delivery Coverage Error:", error);

        return res.status(503).json({
            success: false,
            available: false,
            message: "Unable to check delivery coverage right now. Please try again."
        });
    }
};

export {createBranch, getAllBranches, getActiveBranches, getBranchById, updateBranch, deactivateBranch, deleteBranch, checkDeliveryCoverage};