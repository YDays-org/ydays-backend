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
  "/listings/new",
  validationMiddleware(catalogSchemas.trendingAndNewListingSchema),
  catalogHandlers.getNewListings
);

router.get(
  "/listings/trending",
  validationMiddleware(catalogSchemas.trendingAndNewListingSchema),
  catalogHandlers.getTrendingListings
);

router.get(
  "/listings/:id",
  validationMiddleware(catalogSchemas.listingIdParamSchema),
  catalogHandlers.getListingById
);

router.get("/categories", catalogHandlers.getCategories);

router.get("/amenities", catalogHandlers.getAmenities);

// --- User-Protected Routes ---
router.get(
  "/feed",
  authMiddleware,
  validationMiddleware(catalogSchemas.getFeedSchema),
  catalogHandlers.getPersonalizedFeed
);

router.get(
  "/favorites",
  authMiddleware,
  validationMiddleware(catalogSchemas.getFeedSchema), // Reuse same validation (page, limit)
  catalogHandlers.getFavorites
);

router.get(
  "/favorites/:listingId/check",
  authMiddleware,
  validationMiddleware(catalogSchemas.favoriteParamSchema),
  catalogHandlers.checkFavorite
);

router.post(
  "/favorites/:listingId",
  authMiddleware,
  validationMiddleware(catalogSchemas.favoriteParamSchema),
  catalogHandlers.addFavorite
);

router.delete(
  "/favorites/:listingId",
  authMiddleware,
  validationMiddleware(catalogSchemas.favoriteParamSchema),
  catalogHandlers.removeFavorite
);

// --- Partner-Protected Routes ---
router.post(
  "/listings",
  authMiddleware,
  roleCheck(["partner"]),
  validationMiddleware(catalogSchemas.createListingSchema),
  catalogHandlers.createListing
);

router.put(
  "/listings/:id",
  authMiddleware,
  roleCheck(["partner"]),
  validationMiddleware(catalogSchemas.updateListingSchema),
  catalogHandlers.updateListing
);

router.delete(
  "/listings/:id",
  authMiddleware,
  roleCheck(["partner"]),
  validationMiddleware(catalogSchemas.listingIdParamSchema),
  catalogHandlers.deleteListing
);

export default router;
