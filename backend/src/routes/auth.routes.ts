import * as authController from "@/controllers/auth.controller";
import { Router } from "express";
import { authenticateUser } from "@/middlewares/user.middleware";

const router = Router();

// POST /api/auth/signup
router.post("/signup", authController.signup);

// POST /api/auth/login
router.post("/login", authController.login);

// POST /api/auth/google
router.post("/google", authController.googleAuth);

// POST /api/auth/logout
router.post("/logout", authController.logout);

// GET /api/auth/me - Requires authentication
router.get("/me", authenticateUser, authController.checkAuth);

// Add other auth routes here (e.g., logout)

export default router;
