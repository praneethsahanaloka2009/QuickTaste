import express from "express"

import {createPromoCode, getAllPromoCodes, getPromoCodeById, updatePromoCode, deletePromoCode, validatePromoCode} from "../controllers/promoController.js"

const promoRouter = express.Router()

// Admin routes
promoRouter.post("/create", createPromoCode)
promoRouter.get("/list", getAllPromoCodes)

// Customer route
promoRouter.post("/validate", validatePromoCode)

// Single promo
promoRouter.get("/:id", getPromoCodeById)
promoRouter.put("/:id", updatePromoCode)
promoRouter.delete("/:id", deletePromoCode)

export default promoRouter