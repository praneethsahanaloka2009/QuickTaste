import branchModel from "../models/branchModel.js";
import {calculateRoadDistance, isValidCoordinates} from "./branchRouting.js";

// Find the nearest branch that can deliver to the customer
const selectBestBranch = async (customerLocation) => {
    
    if(!isValidCoordinates(customerLocation)){
        throw new Error("Invalid customer delivery location.");
    }

    // Only active and operational branches
    const branches = await branchModel.find({isActive: true, status: "Operational"}).lean();

    if(branches.length === 0){
        throw new Error("No operational branches available.");
    }

    const availableBranches = [];
    let successfulRoutes = 0;
    let routingFailures = 0;

    for(const branch of branches){
        
        const branchLocation = {
            latitude: branch.location?.latitude,
            longitude: branch.location?.longitude
        };

        // Ignore branches without valid GPS coordinates
        if(!isValidCoordinates(branchLocation)){
            continue;
        }

        const coverageKm = branch.deliveryRadiusKm;

        if(typeof coverageKm !== "number" || !Number.isFinite(coverageKm) || coverageKm <= 0){
            continue;
        }

        try {
            const route = await calculateRoadDistance(branchLocation, customerLocation);

            successfulRoutes++;

            // Check branch-specific delivery coverage
            if(route.distanceKm <= coverageKm){
                availableBranches.push({
                    branchId: branch._id,
                    name: branch.name,
                    code: branch.code,
                    city: branch.city,
                    address: branch.address,
                    location: branchLocation,
                    distanceKm: route.distanceKm,
                    durationMinutes: route.durationMinutes,
                    coverageKm
                });
            }

        } catch (error) {
            routingFailures++;

            console.error(
                `Routing failed for branch ${branch.code}:`,
                error.message
            );
        }

    }

    // Do not mistake a routing outage for no coverage.
    // A failed route may belong to a closer branch.
    if(routingFailures > 0){
        throw new Error("Unable to verify delivery coverage right now.");
    }

    if(successfulRoutes === 0){
        throw new Error("No branches have valid routing locations.");
    }

    if(availableBranches.length === 0){
        throw new Error("Delivery is not available at this location.");
    }

    // Nearest eligible branch by road distance
    availableBranches.sort((a, b) => a.distanceKm - b.distanceKm);

    return {
        selectedBranch: availableBranches[0],
        availableBranches
    };

};

export { selectBestBranch };