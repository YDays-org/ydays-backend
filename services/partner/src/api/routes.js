import { Router } from "express";
import {
  validationMiddleware,
  roleCheck,
  authMiddleware,
} from "@casablanca/common";
import * as partnerHandlers from "./handlers.js";
import * as partnerSchemas from "./validation.js";

const router = Router();

router.use(authMiddleware);

router.get(
  "/bookings",
  roleCheck(["PARTNER"]),
  validationMiddleware(partnerSchemas.getPartnerBookingsSchema),
  partnerHandlers.getPartnerBookings
);

router.get(
  "/bookings/:id",
  roleCheck(["PARTNER"]),
  validationMiddleware(partnerSchemas.bookingIdParamSchema),
  partnerHandlers.getPartnerBookingById
);

router.get(
  "/stats",
  roleCheck(["PARTNER"]),
  validationMiddleware(partnerSchemas.getStatsSchema),
  partnerHandlers.getPartnerDashboardStats
);

router.patch(
  "/bookings/:id/approve",
  roleCheck(["PARTNER"]),
  validationMiddleware(partnerSchemas.bookingIdParamSchema),
  partnerHandlers.approveReservationByPartner
);

router.patch(
  "/bookings/:id/cancel",
  roleCheck(["PARTNER"]),
  validationMiddleware(partnerSchemas.bookingIdParamSchema),
  partnerHandlers.cancelReservationByPartner
);

router.post(
  "/promotions",
  roleCheck(["PARTNER"]),
  validationMiddleware(partnerSchemas.createPromotionSchema),
  partnerHandlers.createPromotion
);

router.get(
  "/promotions",
  roleCheck(["PARTNER"]),
  partnerHandlers.getPromotions
);

router.post(
  "/promotions/:promotionId/apply",
  roleCheck(["PARTNER"]),
  validationMiddleware(partnerSchemas.applyPromotionSchema),
  partnerHandlers.applyPromotionToListings
);

// --- Schedule Management ---
router.get(
  "/listings/:listingId/schedules",
  roleCheck(["PARTNER"]),
  validationMiddleware(partnerSchemas.listingIdParamSchema),
  partnerHandlers.getSchedulesForListing
);

router.post(
  "/listings/:listingId/schedules",
  roleCheck(["PARTNER"]),
  validationMiddleware(partnerSchemas.createScheduleSchema),
  partnerHandlers.createSchedule
);

router.put(
  "/schedules/:scheduleId",
  roleCheck(["PARTNER"]),
  validationMiddleware(partnerSchemas.updateScheduleSchema),
  partnerHandlers.updateSchedule
);

router.delete(
  "/schedules/:scheduleId",
  roleCheck(["PARTNER"]),
  validationMiddleware(partnerSchemas.scheduleIdParamSchema),
  partnerHandlers.deleteSchedule
);

router.get(
  "/listings/:listingId/performance",
  roleCheck(["PARTNER"]),
  validationMiddleware(partnerSchemas.getListingPerformanceStatsSchema),
  partnerHandlers.getListingPerformanceStats
);

export default router; 