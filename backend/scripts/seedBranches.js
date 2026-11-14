import "dotenv/config";
import mongoose from "mongoose";
import branchModel from "../models/branchModel.js";

// Planned QuickTaste branch locations across Sri Lanka
const branchLocations = {
    Western: ["Colombo", "Negombo", "Gampaha", "Wattala", "Ja-Ela", "Kadawatha", "Kelaniya", "Moratuwa", "Panadura", "Kalutara", "Horana", "Homagama", "Maharagama", "Nugegoda", "Dehiwala"],
    Central: ["Kandy", "Matale", "Dambulla", "Nuwara Eliya", "Gampola", "Hatton", "Nawalapitiya"],
    Southern: [ "Galle", "Matara", "Hambantota", "Tangalle", "Ambalangoda", "Hikkaduwa", "Weligama", "Akuressa", "Tissamaharama"],
    Northern: ["Jaffna", "Kilinochchi", "Vavuniya", "Mannar", "Mullaitivu", "Chavakachcheri"],
    Eastern: ["Trincomalee", "Batticaloa", "Ampara", "Kalmunai", "Akkaraipattu", "Kattankudy"],
    "North Western": ["Kurunegala", "Puttalam", "Chilaw", "Kuliyapitiya", "Wennappuwa", "Marawila", "Narammala"],
    "North Central": ["Anuradhapura", "Polonnaruwa", "Kekirawa", "Medawachchiya", "Habarana", "Hingurakgoda"],
    Uva: ["Badulla", "Bandarawela", "Ella", "Welimada", "Monaragala", "Wellawaya", "Haputale"],
    Sabaragamuwa: ["Ratnapura", "Kegalle", "Embilipitiya", "Balangoda", "Mawanella", "Warakapola", "Pelmadulla"]
};

// Generate a stable branch code.
// Example: Negombo -> QT-NEGOMBO-001
const generateBranchCode = (city) => {
    const normalizedCity = city.toUpperCase().replace(/[^A-Z0-9]/g, "");

    return `QT-${normalizedCity}-001`;
}

// Convert the town list into branch documents
const createBranchDocuments = () => {
    const branches = [];

    for(const [province, cities] of Object.entries(branchLocations)){
        for(const city of cities){
            branches.push({
                name: `QuickTaste ${city}`,
                code: generateBranchCode(city),
                province,
                city,
                address: "",
                phone: "",
                email: "",
                location: {
                    latitude: null,
                    longitude: null
                },
                deliveryRadiusKm: 10,
                isActive: false,
                status: "Planned"
            });
        }
    }

    return branches;
}

const seedBranches = async () => {
    try {
        if(!process.env.MONGODB_URI){
            throw new Error(
                "MONGODB_URI is missing from the environment."
            );
        }

        // Use the same MongoDB connection URI as the backend.
        // This script runs independently of server.js.
        await mongoose.connect(process.env.MONGODB_URI);

        console.log("MongoDB connected successfully.");

        const branches = createBranchDocuments();

        const uniqueCodes = new Set(
            branches.map((branch) => branch.code)
        );

        if(uniqueCodes.size !== branches.length){
            throw new Error(
                "Duplicate branch codes found in seed data."
            );
        }

        // Insert missing branches only.
        // Existing branches are not overwritten.
        const operations = branches.map((branch) => ({
            updateOne: {
                filter: {
                    code: branch.code
                },
                update: {
                    $setOnInsert: branch
                },
                upsert: true
            }
        }));

        const result = await branchModel.bulkWrite(operations, { ordered: false });

        console.log("--------------------------------");
        console.log("QuickTaste Branch Seeding Complete");
        console.log("--------------------------------");
        console.log(`Planned locations: ${branches.length}`);
        console.log(`New branches: ${result.upsertedCount}`);
        console.log(`Existing branches matched: ${result.matchedCount}`);
        console.log("--------------------------------");
    } catch (error) {
        console.error("Branch seeding failed:", error);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

seedBranches();