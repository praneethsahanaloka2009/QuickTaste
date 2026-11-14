import promoCodeModel from "../models/promoCodeModel.js";

const VALID_DISCOUNT_TYPES = ["percentage", "fixed", "freeDelivery"];
const DELIVERY_FEE = 2;

// Validate one discount offer
const validateOffer = (discountType, discountValue, offerName) => {
    if(!VALID_DISCOUNT_TYPES.includes(discountType)){
        return `${offerName}: Invalid discount type`;
    }

    if(discountValue === undefined || discountValue === null || discountValue === "" || !Number.isFinite(Number(discountValue)) || Number(discountValue) < 0){
        return `${offerName}: Please enter a valid discount value`;
    }

    if(discountType === "percentage" && Number(discountValue) > 100){
        return `${offerName}: Percentage discount cannot exceed 100%`;
    }

    return null;
};

// Calculate the monetary benefit of an offer
const calculateOffer = (promo, offerNumber, orderAmount) => {
    const suffix = offerNumber === 1 ? "" : "2";

    const discountType = promo[`discountType${suffix}`];
    const discountValue = Number(promo[`discountValue${suffix}`] ?? 0);
    const maxDiscountAmount = promo[`maxDiscountAmount${suffix}`];

    if (!discountType) {
        return null;
    }

    if (discountType === "freeDelivery") {
        return {
            offerNumber,
            discountType,
            discountAmount: 0,
            deliveryDiscountAmount: DELIVERY_FEE,
            benefit: DELIVERY_FEE
        };
    }

    let discountAmount = 0;

    if(discountType === "percentage"){
        discountAmount = orderAmount * (discountValue / 100);

        if(maxDiscountAmount !== null && maxDiscountAmount !== undefined && Number(maxDiscountAmount) >= 0){
            discountAmount = Math.min(discountAmount, Number(maxDiscountAmount));
        }
    } else if (discountType === "fixed") {
        discountAmount = discountValue;
    }

    discountAmount = Number(Math.min(orderAmount, Math.max(0, discountAmount)).toFixed(2));

    return {offerNumber, discountType, discountAmount, deliveryDiscountAmount: 0, benefit: discountAmount};
};

// Choose the offer that gives the customer the highest monetary benefit
const calculateBestOffer = (promo, orderAmount) => {
    const offers = [calculateOffer(promo, 1, orderAmount), calculateOffer(promo, 2, orderAmount)].filter(Boolean);

    if (offers.length === 0) {
        return null;
    }

    // If both offers provide the same benefit, Offer 1 is selected.
    return offers.reduce((best, current) => {
        return current.benefit > best.benefit ? current : best;
    });
};

// Create promo code - admin
const createPromoCode = async (req, res) => {
    try {
        const {code, discountType, discountValue, maxDiscountAmount, discountType2, discountValue2, maxDiscountAmount2, minOrderAmount, expiryDate, usageLimit, offerText, showOnOfferBar} = req.body;

        if (!code?.trim() || !discountType || discountValue === undefined || discountValue === "" || !expiryDate){
            return res.status(400).json({
                success: false,
                message: "Please fill all required fields"
            });
        }

        const firstOfferError = validateOffer(discountType, discountValue, "Offer 1");

        if(firstOfferError){
            return res.status(400).json({
                success: false,
                message: firstOfferError
            });
        }

        // Offer 2 is optional, but both fields must be supplied together.
        const hasSecondType = discountType2 !== undefined && discountType2 !== null && discountType2 !== "";

        const hasSecondValue = discountValue2 !== undefined && discountValue2 !== null && discountValue2 !== "";

        if(hasSecondType !== hasSecondValue){
            return res.status(400).json({
                success: false,
                message: "Please select both Offer 2 type and value"
            });
        }

        if(hasSecondType){
            const secondOfferError = validateOffer(
                discountType2,
                discountValue2,
                "Offer 2"
            );

            if(secondOfferError){
                return res.status(400).json({
                    success: false,
                    message: secondOfferError
                });
            }
        }

        if(Number(minOrderAmount ?? 0) < 0 || !Number.isFinite(Number(minOrderAmount ?? 0))){
            return res.status(400).json({
                success: false,
                message: "Minimum order amount must be a valid non-negative number"
            });
        }

        if(new Date(expiryDate) <= new Date()) {
            return res.status(400).json({
                success: false,
                message: "Expiry date must be in the future"
            });
        }

        const existingPromo = await promoCodeModel.findOne({
            code: code.toUpperCase().trim()
        });

        if(existingPromo){
            return res.status(409).json({
                success: false,
                message: "Promo code already exists"
            });
        }

        const promo = new promoCodeModel({
            code: code.toUpperCase().trim(),

            discountType,
            discountValue: Number(discountValue),
            maxDiscountAmount:
                maxDiscountAmount === "" ||
                maxDiscountAmount === undefined ||
                maxDiscountAmount === null
                    ? null
                    : Number(maxDiscountAmount),

            discountType2: hasSecondType ? discountType2 : null,
            discountValue2: hasSecondValue ? Number(discountValue2) : null,
            maxDiscountAmount2:
                maxDiscountAmount2 === "" ||
                maxDiscountAmount2 === undefined ||
                maxDiscountAmount2 === null
                    ? null
                    : Number(maxDiscountAmount2),

            minOrderAmount: Number(minOrderAmount ?? 0),
            expiryDate,

            usageLimit:
                usageLimit === "" ||
                usageLimit === undefined ||
                usageLimit === null
                    ? null
                    : Number(usageLimit),

            offerText: offerText || "",
            showOnOfferBar: showOnOfferBar === true
        });

        await promo.save();

        return res.status(201).json({
            success: true,
            message: "Promo code created successfully",
            promo
        });
    } catch (error) {
        console.log(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get all promo codes - admin
const getAllPromoCodes = async (req, res) => {
    try {
        const now = new Date();

        await promoCodeModel.updateMany(
            {
                isActive: true,
                expiryDate: { $lte: now }
            },
            {
                $set: { isActive: false }
            }
        );

        await promoCodeModel.updateMany(
            {
                isActive: true,
                usageLimit: { $ne: null },
                $expr: {
                    $gte: ["$usedCount", "$usageLimit"]
                }
            },
            {
                $set: { isActive: false }
            }
        );

        const promos = await promoCodeModel.find({}).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            promos
        });
    } catch (error) {
        console.log(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get single promo code - admin
const getPromoCodeById = async (req, res) => {
    try {
        const { id } = req.params;
        const promo = await promoCodeModel.findById(id);

        if(!promo) {
            return res.status(404).json({
                success: false,
                message: "Promo code not found"
            });
        }

        return res.status(200).json({
            success: true,
            promo
        });
    } catch (error) {
        console.log(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Update promo code - admin
const updatePromoCode = async (req, res) => {
    try {
        const { id } = req.params;

        const {code, discountType, discountValue, maxDiscountAmount, discountType2, discountValue2, maxDiscountAmount2, minOrderAmount, expiryDate, usageLimit, isActive, offerText, showOnOfferBar} = req.body;

        const promo = await promoCodeModel.findById(id);

        if(!promo) {
            return res.status(404).json({
                success: false,
                message: "Promo code not found"
            });
        }

        const nextType1 = discountType ?? promo.discountType;
        const nextValue1 = discountValue ?? promo.discountValue;

        const firstOfferError = validateOffer(
            nextType1,
            nextValue1,
            "Offer 1"
        );

        if(firstOfferError) {
            return res.status(400).json({
                success: false,
                message: firstOfferError
            });
        }

        // Allow Offer 2 to be cleared when editing.
        const nextType2 = discountType2 === undefined ? promo.discountType2 : discountType2 || null;

        const nextValue2 = discountValue2 === undefined ? promo.discountValue2 : discountValue2 === "" || discountValue2 === null ? null : Number(discountValue2);

        if((nextType2 && nextValue2 === null) || (!nextType2 && nextValue2 !== null)){
            return res.status(400).json({
                success: false,
                message: "Please select both Offer 2 type and value, or clear both"
            });
        }

        if(nextType2){
            const secondOfferError = validateOffer(
                nextType2,
                nextValue2,
                "Offer 2"
            );

            if(secondOfferError){
                return res.status(400).json({
                    success: false,
                    message: secondOfferError
                });
            }
        }

        if(code !== undefined){
            if (!code.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Promo code cannot be empty"
                });
            }

            const existingPromo = await promoCodeModel.findOne({
                code: code.toUpperCase().trim(),
                _id: { $ne: id }
            });

            if(existingPromo){
                return res.status(409).json({
                    success: false,
                    message: "Promo code already exists"
                });
            }

            promo.code = code.toUpperCase().trim();
        }

        if(discountType !== undefined){
            promo.discountType = discountType;
        }

        if(discountValue !== undefined){
            promo.discountValue = Number(discountValue);
        }

        if(maxDiscountAmount !== undefined){
            promo.maxDiscountAmount = maxDiscountAmount === "" || maxDiscountAmount === null ? null : Number(maxDiscountAmount);
        }

        promo.discountType2 = nextType2;
        promo.discountValue2 = nextType2 ? nextValue2 : null;

        if(maxDiscountAmount2 !== undefined){
            promo.maxDiscountAmount2 = maxDiscountAmount2 === "" || maxDiscountAmount2 === null ? null : Number(maxDiscountAmount2);
        }

        if(minOrderAmount !== undefined){
            if(!Number.isFinite(Number(minOrderAmount)) || Number(minOrderAmount) < 0){
                return res.status(400).json({
                    success: false,
                    message: "Minimum order amount must be a valid non-negative number"
                });
            }

            promo.minOrderAmount = Number(minOrderAmount);
        }

        if(expiryDate !== undefined){
            if(new Date(expiryDate) <= new Date()) {
                return res.status(400).json({
                    success: false,
                    message: "Expiry date must be in the future"
                });
            }

            promo.expiryDate = expiryDate;
        }

        if(usageLimit !== undefined){
            if(usageLimit === "" || usageLimit === null){
                promo.usageLimit = null;
            } else if(!Number.isInteger(Number(usageLimit)) || Number(usageLimit) < 1){
                return res.status(400).json({
                    success: false,
                    message: "Usage limit must be a positive whole number"
                });
            } else {
                promo.usageLimit = Number(usageLimit);
            }
        }

        if(isActive !== undefined){
            promo.isActive = isActive;
        }

        if(offerText !== undefined){
            promo.offerText = offerText;
        }

        if(showOnOfferBar !== undefined){
            promo.showOnOfferBar = showOnOfferBar;
        }

        await promo.save();

        return res.status(200).json({
            success: true,
            message: "Promo code updated successfully",
            promo
        });
    } catch (error) {
        console.log(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Delete promo code - admin
const deletePromoCode = async (req, res) => {
    try {
        const { id } = req.params;
        const promo = await promoCodeModel.findById(id);

        if (!promo) {
            return res.status(404).json({
                success: false,
                message: "Promo code not found"
            });
        }

        await promoCodeModel.findByIdAndDelete(id);

        return res.status(200).json({
            success: true,
            message: "Promo code deleted successfully"
        });
    } catch (error) {
        console.log(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Validate promo code - customer
const validatePromoCode = async (req, res) => {
    try {
        const { code, orderAmount } = req.body;

        if (!code?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please enter a promo code"
            });
        }

        if(orderAmount === undefined || !Number.isFinite(Number(orderAmount)) || Number(orderAmount) < 0){
            return res.status(400).json({
                success: false,
                message: "Please provide a valid order amount"
            });
        }

        const promo = await promoCodeModel.findOne({
            code: code.toUpperCase().trim()
        });

        if(!promo){
            return res.status(404).json({
                success: false,
                message: "Invalid promo code"
            });
        }

        if(new Date() >= new Date(promo.expiryDate)){
            promo.isActive = false;
            await promo.save();

            return res.status(400).json({
                success: false,
                message: "This promo code has expired"
            });
        }

        if(promo.usageLimit !== null && promo.usageLimit !== undefined && promo.usedCount >= promo.usageLimit){
            promo.isActive = false;
            await promo.save();

            return res.status(400).json({
                success: false,
                message: "This promo code has reached its usage limit"
            });
        }

        if(!promo.isActive){
            return res.status(400).json({
                success: false,
                message: "This promo code is inactive"
            });
        }

        const subtotal = Number(orderAmount);

        if(subtotal < promo.minOrderAmount){
            return res.status(400).json({
                success: false,
                message: `Minimum order amount is $${Number(
                    promo.minOrderAmount
                ).toFixed(2)}`
            });
        }

        if(!promo.discountType){
            return res.status(400).json({
                success: false,
                message: "This promo code has no valid offer"
            });
        }

        // Return the original details of BOTH offers.
        // Do not automatically select the best offer.
        return res.status(200).json({
            success: true,
            message: "Promo code applied successfully.",
            promo: {
                id: promo._id,
                code: promo.code,

                discountType: promo.discountType,
                discountValue: Number(promo.discountValue),
                maxDiscountAmount: promo.maxDiscountAmount ?? null,

                discountType2: promo.discountType2 ?? null,
                discountValue2: promo.discountValue2 != null ? Number(promo.discountValue2) : null,
                maxDiscountAmount2: promo.maxDiscountAmount2 ?? null,

                minOrderAmount: Number(promo.minOrderAmount ?? 0),
                offerText: promo.offerText,
                showOnOfferBar: promo.showOnOfferBar
            }
        });
    } catch (error) {
        console.log(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get active public offers for the Customer Offer Bar
const getPublicOffers = async (req, res) => {
    try {
        const now = new Date();

        const promos = await promoCodeModel.find({
            isActive: true,
            showOnOfferBar: true,
            expiryDate: { $gt: now },
            $or: [
                {
                    usageLimit: null
                },
                {
                    $expr: {
                        $lt: [
                            "$usedCount", "$usageLimit"
                        ]
                    }
                }
            ]
        }).select("code discountType discountValue maxDiscountAmount discountType2 discountValue2 maxDiscountAmount2 minOrderAmount expiryDate offerText showOnOfferBar").sort({ createdAt: -1 }).lean();

        return res.status(200).json({
            success: true,
            promos
        });

    } catch (error) {
        console.error("Get Public Offers Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load public offers"
        });
    }
};

export {createPromoCode, getAllPromoCodes, getPromoCodeById, updatePromoCode, deletePromoCode, validatePromoCode, getPublicOffers};