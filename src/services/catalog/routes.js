import { Router } from "express";
import { validationMiddleware } from "../../common/middlewares/validation.js";
import { roleCheck } from "../../common/middlewares/roles.js";
import * as catalogHandlers from "./handlers.js";
import * as catalogSchemas from "./validation.js";
import { authMiddleware } from "../../common/middlewares/auth.js";

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

// --- User-Protected Routes ---
router.use(authMiddleware);

router.get(
  "/feed",
  validationMiddleware(catalogSchemas.getFeedSchema),
  catalogHandlers.getPersonalizedFeed
);

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

// --- Partner-Protected Routes ---
router.post(
  "/listings",
  roleCheck(["PARTNER"]),
  validationMiddleware(catalogSchemas.createListingSchema),
  catalogHandlers.createListing
);

router.put(
  "/listings/:id",
  roleCheck(["PARTNER"]),
  validationMiddleware(catalogSchemas.updateListingSchema),
  catalogHandlers.updateListing
);

router.delete(
  "/listings/:id",
  roleCheck(["PARTNER"]),
  validationMiddleware(catalogSchemas.listingIdParamSchema),
  catalogHandlers.deleteListing
);

export default router;
