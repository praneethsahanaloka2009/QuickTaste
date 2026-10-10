import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({

    foodId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "food",
        required: true
    },

    name: {
        type: String,
        required: true
    },

    price: {
        type: Number,
        required: true
    },

    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    
    preparationTime: {
        type: Number,
        required: true,
        min: 1,
        default: 15
    }
},{
    _id: false
});

const orderSchema = new mongoose.Schema({

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
    },

    items: {
        type: [orderItemSchema],
        required: true
    },

    amount: {
        type: Number,
        required: true
    },

    deliveryFee: {
        type: Number,
        required: true,
        default: 2
    },

    address: {
        firstName: {
            type: String,
            required: true
        },

        lastName: {
            type: String,
            required: true
        },

        email: {
            type: String,
            required: true
        },

        street: {
            type: String,
            required: true
        },

        city: {
            type: String,
            required: true
        },

        state: {
            type: String,
            required: true
        },

        zipCode: {
            type: String,
            required: true
        },

        country: {
            type: String,
            required: true
        },

        phone: {
            type: String,
            required: true
        }
    },

    paymentStatus: {
        type: String,
        enum: ["Pending", "Paid", "Failed"],
        default: "Pending"
    },

    paymentMethod: {
        type: String,
        enum: ["Pending", "Cash on Delivery", "Online Payment", "Stripe"],
        default: "Pending"
    },

    stripeSessionId: {
        type: String,
        unique: true,
        sparse: true
    },

    orderStatus: {
        type: String,
        enum: [
            "Pending",
            "Processing",
            "Out for Delivery",
            "Delivered",
            "Cancelled"
        ],
        default: "Pending"
    },

    preparationStartedAt: {
        type: Date,
        default: null
    },

    // Cancellation Details
    cancelledBy: {
        type: String,
        enum: ["Customer", "Admin"],
        required: false
    },

    cancellationReason: {
        type: String,
        required: false
    },

    cancelledAt: {
        type: Date,
        required: false
    }
    
},{
    timestamps: true
});

const orderModel = mongoose.models.order || mongoose.model("order", orderSchema);

export default orderModel;