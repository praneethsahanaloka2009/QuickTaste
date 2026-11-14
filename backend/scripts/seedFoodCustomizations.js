import dotenv from "dotenv";
import mongoose from "mongoose";
import foodModel from "../models/foodModel.js";

// Load backend/.env
dotenv.config();

// ==========================================
// QUICKTASTE FOOD CUSTOMIZATION CATALOG
// 32 Products
// Large extra price + individual add-ons
// ==========================================

const catalog = [

    // Salads
    [
        "Greek Salad",
        2.00,
        [
            [
                "Extra Feta Cheese", 1.00
            ],
            [
                "Extra Olives", 0.50
            ],
            [
                "Extra Dressing", 0.50
            ]
        ]
    ],

    [
        "Caesar Salad",
        2.50,
        [
            [
                "Extra Parmesan Cheese", 1.00

            ],
            [
                "Extra Croutons", 0.50
            ],
            [
                "Extra Caesar Dressing", 0.50
            ]
        ]
    ],

    [
        "Chicken Salad",
        3.00,
        [
            [
                "Extra Chicken", 2.00
            ],
            [
                "Extra Cheese", 1.00
            ],
            [
                "Extra Dressing", 0.50
            ]
        ]
    ],

    [
        "Garden Salad",
        2.00,
        [
            [
                "Extra Avocado", 1.50
            ],
            [
                "Extra Olives", 0.50
            ],
            [
                "Extra Dressing", 0.50
            ]
        ]
    ],

    // Wraps
    [
        "Chicken Wrap",
        2.50,
        [
            [
                "Extra Chicken", 2.00
            ],
            [
                "Extra Cheese", 1.00
            ],
            [
                "Extra Garlic Sauce", 0.50
            ]
        ]
    ],

    [
        "Vegetable Wrap",
        2.00,
        [
            [
                "Extra Cheese", 1.00
            ],
            [
                "Extra Hummus", 0.75
            ],
            [
                "Extra Avocado", 1.50
            ]
        ]
    ],

    [
        "Egg Wrap",
        2.00,
        [
            [
                "Extra Egg", 1.00
            ],
            [
                "Extra Cheese", 1.00
            ],
            [
                "Extra Sauce", 0.50
            ]
        ]
    ],

    [
        "Cheese Wrap",
        2.00,
        [
            [
                "Extra Cheese", 1.00
            ],
            [
                "Extra Jalapeños", 0.50
            ],
            [
                "Extra Sauce", 0.50
            ]
        ]
    ],

    // Desserts
    [
        "Chocolate Ice Cream",
        1.50,
        [
            [
                "Chocolate Sauce", 0.50
            ],
            [
                "Chocolate Chips", 0.75
            ],
            [
                "Extra Scoop", 1.50
            ]
        ]
    ],

    [
        "Vanilla Ice Cream",
        1.50,
        [
            [
                "Caramel Sauce", 0.50
            ],
            [
                "Sprinkles", 0.50
            ],
            [
                "Extra Scoop", 1.50
            ]
        ]
    ],

    [
        "Fruit Ice Cream",
        2.00,
        [
            [
                "Fresh Fruit", 1.00
            ],
            [
                "Honey", 0.50
            ],
            [
                "Extra Scoop", 1.50
            ]
        ]
    ],

    [
        "Chocolate Brownie",
        1.50,
        [
            [
                "Chocolate Sauce", 0.50
            ],
            [
                "Vanilla Ice Cream Scoop", 1.50
            ],
            [
                "Whipped Cream", 0.75
            ]
        ]
    ],

    // Sandwiches
    [
        "Chicken Sandwich",
        2.50,
        [
            [
                "Extra Chicken", 2.00
            ],
            [
                "Extra Cheese", 1.00
            ],
            [
                "Extra Mayo", 0.50
            ]
        ]
    ],

    [
        "Grilled Cheese Sandwich",
        2.00,
        [
            [
                "Extra Cheese", 1.00
            ],
            [
                "Extra Tomato", 0.50
            ],
            [
                "Extra Sauce", 0.50
            ]
        ]
    ],

    [
        "Grilled Sandwich",
        2.00,
        [
            [
                "Extra Cheese", 1.00
            ],
            [
                "Extra Vegetables", 0.75
            ],
            [
                "Extra Sauce", 0.50
            ]
        ]
    ],

    [
        "Club Sandwich",
        3.00,
        [
            [
                "Extra Chicken", 2.00
            ],
            [
                "Extra Cheese", 1.00
            ],
            [
                "Extra Egg", 1.00
            ]
        ]
    ],

    // Cakes
    [
        "Chocolate Cake",
        2.00,
        [
            [
                "Chocolate Sauce", 0.50
            ],
            [
                "Whipped Cream", 0.75
            ],
            [
                "Chocolate Chips", 0.75
            ]
        ]
    ],

    [
        "Vanilla Cake",
        1.50,
        [
            [
                "Whipped Cream", 0.75
            ],
            [
                "Fresh Strawberries", 1.00
            ],
            [
                "Sprinkles", 0.50
            ]
        ]
    ],

    [
        "Red Velvet Cake",
        2.00,
        [
            [
                "Extra Cream Cheese Frosting", 1.00
            ],
            [
                "Whipped Cream", 0.75
            ],
            [
                "Chocolate Drizzle", 0.50
            ]
        ]
    ],

    [
        "Black Forest Cake",
        2.00,
        [
            [
                "Extra Cherries", 1.00
            ],
            [
                "Whipped Cream", 0.75
            ],
            [
                "Chocolate Shavings", 0.75
            ]
        ]
    ],

    // Pure Veg
    [
        "Vegetable Pulao",
        1.50,
        [
            [
                "Extra Vegetables", 1.00
            ],
            [
                "Extra Raita", 0.75
            ],
            [
                "Extra Cashews", 1.00
            ]
        ]
    ],

    [
        "Garlic Butter Mushroom",
        2.50,
        [
            [
                "Extra Mushrooms", 2.00
            ],
            [
                "Extra Garlic Butter", 0.75
            ],
            [
                "Extra Herbs", 0.50
            ]
        ]
    ],

    [
        "Vegetable Fried Rice",
        1.50,
        [
            [
                "Extra Vegetables", 1.00
            ],
            [
                "Extra Tofu", 1.50
            ],
            [
                "Extra Chili Sauce", 0.50
            ]
        ]
    ],

    [
        "Paneer Curry",
        2.00,
        [
            [
                "Extra Paneer", 2.00
            ],
            [
                "Extra Gravy", 1.00
            ],
            [
                "Extra Cream", 0.75
            ]
        ]
    ],

    // Pasta
    [
        "Creamy Chicken Pasta",
        2.50,
        [
            [
                "Extra Chicken", 2.00
            ],
            [
                "Extra Parmesan", 1.00
            ],
            [
                "Extra Cream Sauce", 0.75
            ]
        ]
    ],

    [
        "Creamy Garlic Pasta",
        2.00,
        [
            [
                "Extra Mushrooms", 1.50
            ],
            [
                "Extra Parmesan", 1.00
            ],
            [
                "Extra Garlic Sauce", 0.75
            ]
        ]
    ],

    [
        "Tomato Pasta",
        2.00,
        [
            ["Extra Cheese", 1.00],
            ["Extra Tomato Sauce", 0.50],
            ["Extra Mushrooms", 1.50]
        ]
    ],

    [
        "Cheese Pasta",
        2.00,
        [
            [
                "Extra Cheese", 1.50
            ],
            [
                "Extra Chicken", 2.00
            ],
            [
                "Extra Cheese Sauce", 0.75
            ]
        ]
    ],

    // Noodles
    [
        "Chicken Noodles",
        2.00,
        [
            [
                "Extra Chicken", 2.00
            ],
            [
                "Extra Egg", 1.00
            ],
            [
                "Extra Chili Sauce", 0.50
            ]
        ]
    ],

    [
        "Vegetable Noodles",
        1.50,
        [
            [
                "Extra Vegetables", 1.00
            ],
            [
                "Extra Tofu", 1.50
            ],
            [
                "Extra Chili Sauce", 0.50
            ]
        ]
    ],

    [
        "Egg Noodles",
        1.50,
        [
            [
                "Extra Egg", 1.00
            ],
            [
                "Extra Vegetables", 1.00
            ],
            [
                "Extra Chili Sauce", 0.50
            ]
        ]
    ],

    [
        "Vegetable Stir-Fried Noodles",
        1.50,
        [
            [
                "Extra Vegetables", 1.00
            ],
            [
                "Extra Mushrooms", 1.50
            ],
            [
                "Extra Stir-Fry Sauce", 0.50
            ]
        ]
    ]
];

// Helpers
const normalizeName = (name) =>
    String(name).trim().toLowerCase().replace(/\s+/g, " ");

const sizeAliases = new Set([
    "size",
    "portion size",
    "portion sizes"
]);

const addonAliases = new Set([
    "extra add-ons",
    "extra addons",
    "add-ons",
    "addons"
]);

// Default = Preview, --apply = Save to DB
const apply = process.argv.includes("--apply");

const findGroup = (groups, aliases) =>
    groups.find((group) =>
        aliases.has(normalizeName(group.name))
    );

// Escape special characters in product names
const escapeRegex = (value) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Create Portion Size Group
const createSizeGroup = (largeExtra) => ({
    name: "Size",
    selectionType: "single",
    required: false,
    minSelect: 0,
    maxSelect: 1,
    options: [
        {
            name: "Regular",
            price: 0,
            isAvailable: true
        },
        {
            name: "Large",
            price: largeExtra,
            isAvailable: true
        }
    ]
});

// Create Extra Add-Ons Group
const createAddonGroup = (addons) => ({
    name: "Extra Add-ons",
    selectionType: "multiple",
    required: false,
    minSelect: 0,
    maxSelect: Math.min(3, addons.length),
    options: addons.map(([name, price]) => ({
        name,
        price,
        isAvailable: true
    }))
});

// Main Seed Function
const seedFoodCustomizations = async () => {
    try {
        if(!process.env.MONGODB_URI){
            throw new Error("MONGODB_URI is missing from backend/.env");
        }

        await mongoose.connect(process.env.MONGODB_URI);

        console.log("\n==================================");
        console.log("QUICKTASTE FOOD CUSTOMIZATION");
        console.log("==================================");
        console.log("Database:", mongoose.connection.name);
        console.log(apply ? "MODE: APPLY CHANGES" : "MODE: PREVIEW ONLY");
        console.log("Existing customization prices and IDs are preserved.\n");

        let updated = 0;
        let unchanged = 0;
        let skipped = 0;

        for(const [name, largeExtra, addons] of catalog){

            const matches = await foodModel.find({
                name: {
                    $regex: `^${escapeRegex(name)}$`,
                    $options: "i"
                }
            });

            // Never update an ambiguous product match
            if(matches.length !== 1){
                console.log(`[SKIP] ${name}: ${matches.length} matches found`);
                skipped++;
                continue;
            }

            const food = matches[0];

            const groups = food.customizationGroups || [];

            let sizeGroup = findGroup(
                groups,
                sizeAliases
            );

            let addonGroup = findGroup(
                groups,
                addonAliases
            );

            const changes = [];

            // Portion Sizes
            if(!sizeGroup){
                groups.push(createSizeGroup(largeExtra));
                changes.push(`Add Size (Large +$${largeExtra.toFixed(2)})`);
            } else {
                // Keep all existing size option prices and existing MongoDB option IDs. Only change selection rules if needed.
                if(sizeGroup.required || Number(sizeGroup.minSelect) !== 0 || sizeGroup.selectionType !== "single" || Number(sizeGroup.maxSelect) !== 1){
                    sizeGroup.required = false;
                    sizeGroup.minSelect = 0;
                    sizeGroup.selectionType = "single";
                    sizeGroup.maxSelect = 1;
                    changes.push("Make existing Size optional");
                }
            }

            // Extra Add-Ons
            if(!addonGroup){
                groups.push(createAddonGroup(addons));
                changes.push("Add 3 Extra Add-ons");
            } else {
                // Keep previously configured Add-ons and their existing prices.
                if(addonGroup.required || Number(addonGroup.minSelect) !== 0 || addonGroup.selectionType !== "multiple"){
                    addonGroup.required = false;
                    addonGroup.minSelect = 0;
                    addonGroup.selectionType = "multiple";
                    changes.push("Make existing Add-ons optional");
                }
            }

            // Preview / Save
            if(changes.length === 0){
                console.log(`[KEEP] ${name}: already configured`);

                unchanged++;
                continue;
            }

            updated++;

            console.log(`[${apply ? "UPDATE" : "PREVIEW"}] ${name}`);

            for(const change of changes){
                console.log(`    - ${change}`);
            }

            if(apply){
                food.customizationGroups = groups;
                await food.save();
            }
        }

        console.log("\n==================================");
        console.log("SUMMARY");
        console.log(`Products in catalog: ${catalog.length}`);
        console.log(`Products to update: ${updated}`);
        console.log(`Already configured: ${unchanged}`);
        console.log(`Skipped: ${skipped}`);

        console.log("==================================\n");

        if(!apply){
            console.log("PREVIEW COMPLETE: No database changes made.");
            console.log("Review the results before using --apply.");
        } else {
            console.log("APPLY COMPLETE: Database updates saved.");
        }

    } catch (error) {
        console.error("Food Customization Seed Error:", error);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
};

seedFoodCustomizations();