import express from 'express';
import { loginAdmin, registerAdmin, googleAdminLogin, googleAdminRegister } from '../controllers/adminController.js'

const adminRouter = express.Router()

adminRouter.post("/register", registerAdmin);
adminRouter.post("/login", loginAdmin);
adminRouter.post("/google-register", googleAdminRegister);
adminRouter.post("/google-login", googleAdminLogin);

export default adminRouter;