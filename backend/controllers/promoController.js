import promoCodeModel from "../models/promoCodeModel.js"

// Create promo code - admin
const createPromoCode = async (req, res) => {
    
    try {
        
        const {code, discountType, discountValue, minOrderAmount, maxDiscountAmount, expiryDate, usageLimit, offerText, showOnOfferBar} = req.body

        // check required fields
        if(!code || !discountType || discountValue === undefined || !expiryDate){
            return res.status(400).json({
                success: false,
                message: "Please fill all required fields"
            })
        }

        // Check discount type
        if(!["percentage", "fixed"].includes(discountType)){
            
            return res.status(400).json({
                success: false,
                message: "Invalid discount type"
            })

        }

        // Check percentage value
        if(discountType === "percentage" && discountValue > 100){
            
            return res.status(400).json({
                success: false,
                message: "Percentage discount cannot exceed 100%"
            })

        }

        // Check expiry date
        if(new Date(expiryDate) <= new Date()){
            
            return res.status(400).json({
                success: false,
                message: "Expiry date must be in the future"
            })

        }

        // Check existing promo code
        const existingPromo = await promoCodeModel.findOne({
            code: code.toUpperCase().trim()
        })

        if(existingPromo){
            
            return res.status(409).json({
                success: false,
                message: "Promo code already exists"
            })

        }

        // Create promocode
        const promo = new promoCodeModel({
            
            code : code.toUpperCase().trim(),
            discountType,
            discountValue,
            minOrderAmount: minOrderAmount || 0,
            maxDiscountAmount: maxDiscountAmount === "" || maxDiscountAmount === undefined ? null : maxDiscountAmount,
            expiryDate,
            usageLimit: usageLimit === "" || usageLimit === undefined ? null : usageLimit,
            offerText: offerText || "",
            showOnOfferBar: showOnOfferBar === true

        })

        await promo.save()

        return res.status(201).json({
            success: true,
            message: "Promo code created successfully",
            promo
        })

    } catch (error) {
        
        console.log(error)

        return res.status(500).json({
            success: false,
            message: error.message
        })

    }

}

// Get all promo codes - admin
const getAllPromoCodes = async (req, res) => {
    
    try {
        
        const promos = await promoCodeModel.find({}).sort({ createdAt: -1 })

        return res.status(200).json({
            success: true,
            promos
        })

    } catch (error) {
        
        console.log(error)

        return res.status(500).json({
            success: false,
            message: error.message
        })

    }

}

// Get single promo code - admin
const getPromoCodeById = async (req, res) => {
    
    try {
        
        const { id } = req.params

        const promo = await promoCodeModel.findById(id)

        if(!promo){
            
            return res.status(404).json({
                success: false,
                message: "Promo code not found"
            })

        }

        return res.status(200).json({
            success: true,
            promo
        })

    } catch (error) {
        
        console.log(error)

        return res.status(500).json({
            success: false,
            message: error.message
        })

    }

}

// Update promo code - admin
const updatePromoCode = async (req, res) => {
    
    try {
        
        const { id } = req.params

        const {code, discountType, discountValue, minOrderAmount, maxDiscountAmount, expiryDate, usageLimit, isActive, offerText, showOnOfferBar} = req.body

        // Check promo exists
        const promo = await promoCodeModel.findById(id)

        if(!promo){
            return res.status(404).json({
                success: false,
                message: "Promo code not found"
            })
        }

        // Validate discount type
        if(discountType && !["percentage", "fixed"].includes(discountType)){
            
            return res.status(400).json({
                success: false,
                message: "Invalid discount type"
            })

        }

        // Validate percentage
        if(discountType === "percentage" && discountValue !== undefined && discountValue > 100){

            return res.status(400).json({
                success: false,
                message: "Percentage discount cannot exceed 100%"
            })

        }

        // Check duplicate code
        if(code){
            
            const existingPromo = await promoCodeModel.findOne({
                code: code.toUpperCase().trim(),
                _id: { $ne: id }
            })

            if(existingPromo){
                
                return res.status(409).json({
                    success: false,
                    message: "Promo code already exists"
                })

            }
            
        }

        // Update fields
        if(code !== undefined){
            promo.code = code.toUpperCase().trim()
        }

        if(discountType !== undefined){
            promo.discountType = discountType
        }

        if(discountValue !== undefined){
            promo.discountValue = discountValue
        }

        if(minOrderAmount !== undefined){
            promo.minOrderAmount = minOrderAmount
        }

        if(maxDiscountAmount !== undefined){
            promo.maxDiscountAmount = maxDiscountAmount === "" ? null : maxDiscountAmount
        }

        if(expiryDate !== undefined){
            promo.expiryDate = expiryDate
        }

        if(usageLimit !== undefined){
            promo.usageLimit = usageLimit === "" ? null : usageLimit
        }

        if(isActive !== undefined){
            promo.isActive = isActive
        }

        if(offerText !== undefined){
            promo.offerText = offerText
        }

        if(showOnOfferBar !== undefined){
            promo.showOnOfferBar = showOnOfferBar
        }

        await promo.save()

        return res.status(200).json({
            success: true,
            message: "Promo code updated successfully",
            promo
        })

    } catch (error) {
        
        console.log(error)

        return res.status(500).json({
            success: false,
            message: error.message
        })

    }

}

// Delete promo code - admin
const deletePromoCode = async (req, res) => {
    
    try {
        
        const { id } = req.params

        const promo = await promoCodeModel.findById(id)

        if(!promo){
            
            return res.status(404).json({
                success: false,
                message: "Promo code not found"
            })

        }

        await promoCodeModel.findByIdAndDelete(id)

        return res.status(200).json({
            success: true,
            message: "Promo code deleted successfully"
        })

    } catch (error) {
        
        console.log(error)

        return res.status(500).json({
            success: false,
            message: error.message
        })

    }

}

// Validate promo code - customer
const validatePromoCode = async (req, res) => {
    
    try {
        
        const {code, orderAmount} = req.body

        if(!code){
            
            return res.status(400).json({
                success: false,
                message: "Please enter a promo code"
            })

        }

        const promo = await promoCodeModel.findOne({
            code: code.toUpperCase().trim()
        })

        // Promo not found
        if(!promo){
            
            return res.status(404).json({
                success: false,
                message: "Invalid promo code"
            })

        }

        // Check active
        if(!promo.isActive){
            
            return res.status(400).json({
                success: false,
                message: "This promo code is inactive"
            })

        }

        // Check expiry
        if(new Date() > promo.expiryDate){
            
            return res.status(400).json({
                success: false,
                message: "This promo code has expired"
            })

        }

        // Check usage limit
        if(promo.usageLimit !== null && promo.usedCount >= promo.usageLimit){
            
            return res.status(400).json({
                success: false,
                message: "This promo code has reached its usage limit"
            })

        }

        // Check minimum order amount
        if(orderAmount === undefined || Number(orderAmount) < promo.minOrderAmount){
            
            return res.status(400).json({
                success: false,
                message: `Minimum order amount is $${promo.minOrderAmount.toFixed(2)}`
            })

        }

        // Calculate discount
        let discountAmount = 0

        if(promo.discountType === "percentage"){
            
            discountAmount = Number(orderAmount) * (promo.discountValue / 100)

            // Apply maximum discount
            if(promo.maxDiscountAmount !== null && discountAmount > promo.maxDiscountAmount){
                discountAmount = promo.maxDiscountAmount
            }

        } else {
            
            discountAmount = promo.discountValue

        }

        // Don't allow discount greater than order amount
        if(discountAmount > Number(orderAmount)){
            discountAmount = Number(orderAmount)
        }

        const finalAmount = Number(orderAmount) - discountAmount

        return res.status(200).json({
            success: true,
            message: "Promo code applied successfully",
            promo: {
                id: promo._id,
                code: promo.code,
                discountType: promo.discountType,
                discountValue: promo.discountValue,
                offerText: promo.offerText,
                showOnOfferBar: promo.showOnOfferBar
            },
            discountAmount: Number(discountAmount.toFixed(2)),
            finalAmount: Number(finalAmount.toFixed(2))
        })

    } catch (error) {
        
        console.log(error)

        return res.status(500).json({
            success: false,
            message: error.message
        })

    }

}

export {createPromoCode, getAllPromoCodes, getPromoCodeById, updatePromoCode, deletePromoCode, validatePromoCode}