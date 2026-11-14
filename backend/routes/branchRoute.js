import express from "express";
import { createBranch, getAllBranches, getActiveBranches, getBranchById, updateBranch, deactivateBranch, deleteBranch, checkDeliveryCoverage} from "../controllers/branchController.js";
import adminAuth from "../middleware/adminAuth.js";

const branchRouter = express.Router();

// Public Route
// Customers can view operational branches.
branchRouter.get("/active", getActiveBranches);

// Check delivery coverage using customer GPS coordinates.
branchRouter.post("/check-coverage", checkDeliveryCoverage);

// Admin Routes
// All routes below require a valid Admin JWT.
branchRouter.use(adminAuth);

// Create a new branch
branchRouter.post("/create", createBranch);

// Get all branches
branchRouter.get("/list", getAllBranches);

// Get a single branch
branchRouter.get("/:id", getBranchById);

// Update branch details
branchRouter.put("/:id", updateBranch);

// Deactivate a branch
branchRouter.put("/:id/deactivate", deactivateBranch);

// Delete a branch
branchRouter.delete("/:id", deleteBranch);

export default branchRouter;