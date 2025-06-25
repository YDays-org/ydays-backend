import { Router } from "express";
import { validationMiddleware } from "../../common/middlewares/validation.js";
import { roleCheck } from "../../common/middlewares/roles.js";
import * as catalogHandlers from "./handlers.js";
import * as catalogSchemas from "./validation.js";

const router = Router();

// --- Public Routes ---
router.get(
  "/listings",
  validationMiddleware(catalogSchemas.getListingsSchema),
  catalogHandlers.getListings
);

router.get(
  "/listings/:id",
  validationMiddleware(catalogSchemas.listingIdParamSchema),
  catalogHandlers.getListingById
);

router.get("/categories", catalogHandlers.getCategories);

router.get("/amenities", catalogHandlers.getAmenities);

// --- Partner-Protected Routes ---
router.post(
  "/listings",
  roleCheck(["partner"]),
  validationMiddleware(catalogSchemas.createListingSchema),
  catalogHandlers.createListing
);

router.put(
  "/listings/:id",
  roleCheck(["partner"]),
  validationMiddleware(catalogSchemas.updateListingSchema),
  catalogHandlers.updateListing
);

router.delete(
  "/listings/:id",
  roleCheck(["partner"]),
  validationMiddleware(catalogSchemas.listingIdParamSchema),
  catalogHandlers.deleteListing
);

// --- User-Protected Routes ---
router.post(
  "/favorites/:listingId",
  validationMiddleware(catalogSchemas.favoriteParamSchema),
  catalogHandlers.addFavorite
);

router.delete(
  "/favorites/:listingId",
  validationMiddleware(catalogSchemas.favoriteParamSchema),
  catalogHandlers.removeFavorite
);

export default router;
