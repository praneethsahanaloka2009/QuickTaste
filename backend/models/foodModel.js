import mongoose from "mongoose";

// Food Customization Option Schema
const customizationOptionSchema = new mongoose.Schema({
    
    // Option name: Regular, Large, Extra Cheese
    name : {
        type : String,
        required : true,
        trim : true,
        maxlength : 100
    },

    // Additional price for this option
    price : {
        type : Number,
        required : true,
        min : 0,
        default : 0
    },

    // Admin can temporarily disable an option
    isAvailable : {
        type : Boolean,
        default : true
    }

},
{
    _id : true
});

// Food Customization Group Schema
const customizationGroupSchema = new mongoose.Schema({
    
    // Example: Size, Spice Level, Extra Add-ons
    name : {
        type : String,
        required : true,
        trim : true,
        maxlength : 100
    },

    // Single choice or multiple choices
    selectionType : {
        type : String,
        enum : ["single", "multiple"],
        required : true,
        default : "single"
    },

    // Whether selecting this group is required
    required : {
        type : Boolean,
        default : false
    },

    // Minimum number of selections
    minSelect : {
        type : Number,
        min : 0,
        default : 0
    },

    // Maximum number of selections
    maxSelect : {
        type : Number,
        min : 1,
        default : 1
    },

    // Available options in this group
    options : {
        type : [customizationOptionSchema],
        default : []
    }

},{
    _id : true
});

// Food Product Schema
const foodSchema = new mongoose.Schema({
    
    name : {
        type : String,
        required : true,
        trim : true
    },

    description : {
        type : String,
        required : true,
        trim : true
    },

    price : {
        type : Number,
        required : true,
        min : 0.01
    },

    image : {
        type : String,
        required : true
    },

    category : {
        type : String,
        required : true,
        trim : true
    },

    preparationTime : {
        type : Number,
        required : true,
        min : 1,
        default : 15
    },

    // Food Ingredients
    ingredients : {
        type : [
            {
                type : String,
                trim : true
            }
        ],
        default : []
    },

    // Food Customization and Add-Ons
    customizationGroups : {
        type : [customizationGroupSchema],
        default : []
    }

});

const foodModel = mongoose.models.food || mongoose.model("food", foodSchema);

export default foodModel;