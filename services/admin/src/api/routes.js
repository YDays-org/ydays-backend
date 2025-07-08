import { Router } from "express";
import {
  validationMiddleware,
  roleCheck,
  authMiddleware,
} from "@casablanca/common";
import * as adminHandlers from "./handlers.js";
import * as adminSchemas from "./validation.js";

const router = Router();

// Protect all routes in this service with authentication and role check
router.use(authMiddleware);
router.use(roleCheck(["ADMIN"]));

// --- Category Routes ---
router.post(
  "/categories",
  validationMiddleware(adminSchemas.createCategorySchema),
  adminHandlers.createCategory
);

router.put(
  "/categories/:id",
  validationMiddleware(adminSchemas.updateCategorySchema),
  adminHandlers.updateCategory
);

router.delete(
  "/categories/:id",
  validationMiddleware(adminSchemas.categoryIdParamSchema),
  adminHandlers.deleteCategory
);


// --- Amenity Routes ---
router.post(
  "/amenities",
  validationMiddleware(adminSchemas.createAmenitySchema),
  adminHandlers.createAmenity
);

router.put(
  "/amenities/:id",
  validationMiddleware(adminSchemas.updateAmenitySchema),
  adminHandlers.updateAmenity
);

router.delete(
  "/amenities/:id",
  validationMiddleware(adminSchemas.amenityIdParamSchema),
  adminHandlers.deleteAmenity
);

// --- User Management Routes ---
router.get(
  "/users",
  validationMiddleware(adminSchemas.listUsersSchema),
  adminHandlers.listUsers
);

router.get(
  "/users/:userId",
  validationMiddleware(adminSchemas.userIdParamSchema),
  adminHandlers.getUserById
);

router.patch(
  "/users/:userId/role",
  validationMiddleware(adminSchemas.updateUserRoleSchema),
  adminHandlers.updateUserRole
);

export default router; 