import express from "express"
import {createPromoCode, getAllPromoCodes, getPromoCodeById, updatePromoCode, deletePromoCode, validatePromoCode, getPublicOffers} from "../controllers/promoController.js"
import adminAuth from "../middleware/adminAuth.js";

const promoRouter = express.Router();

// Public Route - Customer Promo Validation
promoRouter.post("/validate", validatePromoCode);
promoRouter.get("/public-offers", getPublicOffers);

// Protected Routes - Admin Only
promoRouter.post("/create", adminAuth, createPromoCode);
promoRouter.get("/list", adminAuth, getAllPromoCodes);
promoRouter.get("/:id", adminAuth, getPromoCodeById);
promoRouter.put("/:id", adminAuth, updatePromoCode);
promoRouter.delete("/:id", adminAuth, deletePromoCode);

export default promoRouter;