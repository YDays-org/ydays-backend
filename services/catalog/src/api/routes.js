import { Router } from "express";
import {
  validationMiddleware,
  roleCheck,
  authMiddleware,
} from "@casablanca/common";
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
  // roleCheck(["partner"]),
  // validationMiddleware(catalogSchemas.createListingSchema),
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

export default router;
