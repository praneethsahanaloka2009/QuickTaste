import express from "express";
import adminAuth from "../middleware/adminAuth.js";
import { createCodSettlement, getCodSettlements, confirmCodSettlement } from"../controllers/codSettlementController.js";

const codSettlementRouter = express.Router();

// Protect all COD settlement routes with Admin JWT
codSettlementRouter.use(adminAuth);

// Create a daily COD settlement batch
codSettlementRouter.post("/create", createCodSettlement);

// Get all COD settlements
// Supports status, branchId and riderId filters
codSettlementRouter.get("/list", getCodSettlements);

// Confirm cash received by the branch
codSettlementRouter.put("/:id/confirm", confirmCodSettlement);

export default codSettlementRouter;