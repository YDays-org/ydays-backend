import { Router } from "express";
import { validationMiddleware } from "../../common/middlewares/validation.js";
import { roleCheck } from "../../common/middlewares/roles.js";
import * as partnerHandlers from "./handlers.js";
import * as partnerSchemas from "./validation.js";
import { authMiddleware } from "../../common/middlewares/auth.js";

const router = Router();

// router.use(authMiddleware);

router.get(
  "/bookings",
  // roleCheck(["PARTNER"]),
  validationMiddleware(partnerSchemas.getPartnerBookingsSchema),
  partnerHandlers.getPartnerBookings
);

router.get(
  "/bookings/:id",
  // roleCheck(["PARTNER"]),
  validationMiddleware(partnerSchemas.bookingIdParamSchema),
  partnerHandlers.getPartnerBookingById
);

router.get(
  "/stats",
  // roleCheck(["PARTNER"]),
  validationMiddleware(partnerSchemas.getStatsSchema),
  partnerHandlers.getPartnerDashboardStats
);

router.patch(
  "/bookings/:id/approve",
  // roleCheck(["PARTNER"]),
  validationMiddleware(partnerSchemas.bookingIdParamSchema),
  partnerHandlers.approveReservationByPartner
);

router.patch(
  "/bookings/:id/cancel",
  // roleCheck(["PARTNER"]),
  validationMiddleware(partnerSchemas.bookingIdParamSchema),
  partnerHandlers.cancelReservationByPartner
);

router.post(
  "/promotions",
  // roleCheck(["PARTNER"]),
  validationMiddleware(partnerSchemas.createPromotionSchema),
  partnerHandlers.createPromotion
);

router.get(
  "/promotions",
  // roleCheck(["PARTNER"]),
  partnerHandlers.getPromotions
);

router.get(
  "/promotions/:promotionId",
  // roleCheck(["PARTNER"]),
  validationMiddleware(partnerSchemas.promotionIdParamSchema),
  partnerHandlers.getPromotionById
);

router.put(
  "/promotions/:promotionId",
  // roleCheck(["PARTNER"]),
  validationMiddleware(partnerSchemas.updatePromotionSchema),
  partnerHandlers.updatePromotion
);

router.delete(
  "/promotions/:promotionId",
  // roleCheck(["PARTNER"]),
  validationMiddleware(partnerSchemas.promotionIdParamSchema),
  partnerHandlers.deletePromotion
);

router.delete(
  "/promotions/:promotionId/listings/:listingId",
  // roleCheck(["PARTNER"]),
  validationMiddleware(partnerSchemas.removePromotionFromListingSchema),
  partnerHandlers.removePromotionFromListing
);

router.post(
  "/promotions/:promotionId/apply",
  // roleCheck(["PARTNER"]),
  validationMiddleware(partnerSchemas.applyPromotionSchema),
  partnerHandlers.applyPromotionToListings
);

// --- Schedule Management ---
router.get(
  "/listings/:listingId/schedules",
  // roleCheck(["PARTNER"]),
  validationMiddleware(partnerSchemas.listingIdParamSchema),
  partnerHandlers.getSchedulesForListing
);

router.post(
  "/listings/:listingId/schedules",
  // roleCheck(["PARTNER"]),
  validationMiddleware(partnerSchemas.createScheduleSchema),
  partnerHandlers.createSchedule
);

router.post(
  "/listings/:listingId/schedules/bulk",
  // roleCheck(["PARTNER"]),
  validationMiddleware(partnerSchemas.createBulkSchedulesSchema),
  partnerHandlers.createBulkSchedules
);

router.put(
  "/schedules/:scheduleId",
  // roleCheck(["PARTNER"]),
  validationMiddleware(partnerSchemas.updateScheduleSchema),
  partnerHandlers.updateSchedule
);

router.delete(
  "/schedules/:scheduleId",
  // roleCheck(["PARTNER"]),
  validationMiddleware(partnerSchemas.scheduleIdParamSchema),
  partnerHandlers.deleteSchedule
);

router.get(
  "/listings/:listingId/performance",
  // roleCheck(["PARTNER"]),
  validationMiddleware(partnerSchemas.getListingPerformanceStatsSchema),
  partnerHandlers.getListingPerformanceStats
);

export default router;