import { Router } from "express";
import { validationMiddleware } from "../../common/middlewares/validation.js";
import * as authHandlers from "./handlers.js";
import * as authSchemas from "./validation.js";
import { authMiddleware } from "../../common/middlewares/auth.js";

const router = Router();

// --- Public Routes ---
router.post("/sign-up", validationMiddleware(authSchemas.signUpSchema), authHandlers.signUp);
router.post("/reset-password", validationMiddleware(authSchemas.requestPasswordResetSchema), authHandlers.requestPasswordReset);

// --- Protected Routes ---
// router.use(authMiddleware);

router.get("/profile", authHandlers.getProfile);
router.put("/profile", validationMiddleware(authSchemas.updateProfileSchema), authHandlers.updateProfile);
router.post("/change-password", validationMiddleware(authSchemas.changePasswordSchema), authHandlers.changePassword);
router.post("/send-verification-email", authHandlers.sendVerificationEmail);
router.delete("/account", authHandlers.deleteAccount);

export default router;
