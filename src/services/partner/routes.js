import { Router } from "express";
import { validationMiddleware } from "../../common/middlewares/validation.js";
import { roleCheck } from "../../common/middlewares/roles.js";
import * as partnerHandlers from "./handlers.js";
import * as partnerSchemas from "./validation.js";
import { authMiddleware } from "../../common/middlewares/auth.js";

const router = Router();

router.get(
  "/bookings",
  authMiddleware,
  roleCheck(["partner"]),
  validationMiddleware(partnerSchemas.getPartnerBookingsSchema),
  partnerHandlers.getPartnerBookings
);

router.get(
  "/bookings/:id",
  authMiddleware,
  roleCheck(["partner"]),
  validationMiddleware(partnerSchemas.bookingIdParamSchema),
  partnerHandlers.getPartnerBookingById
);

router.get(
  "/stats",
  authMiddleware,
  roleCheck(["partner"]),
  validationMiddleware(partnerSchemas.getStatsSchema),
  partnerHandlers.getPartnerDashboardStats
);

router.patch(
  "/bookings/:id/approve",
  authMiddleware,
  roleCheck(["partner"]),
  validationMiddleware(partnerSchemas.bookingIdParamSchema),
  partnerHandlers.approveReservationByPartner
);

router.patch(
  "/bookings/:id/cancel",
  authMiddleware,
  roleCheck(["partner"]),
  validationMiddleware(partnerSchemas.bookingIdParamSchema),
  partnerHandlers.cancelReservationByPartner
);

router.post(
  "/promotions",
  authMiddleware,
  roleCheck(["partner"]),
  validationMiddleware(partnerSchemas.createPromotionSchema),
  partnerHandlers.createPromotion
);

router.get(
  "/promotions",
  authMiddleware,
  roleCheck(["partner"]),
  partnerHandlers.getPromotions
);

router.post(
  "/promotions/:promotionId/apply",
  authMiddleware,
  roleCheck(["partner"]),
  validationMiddleware(partnerSchemas.applyPromotionSchema),
  partnerHandlers.applyPromotionToListings
);

// --- Schedule Management ---
router.get(
  "/listings/:listingId/schedules",
  authMiddleware,
  roleCheck(["partner"]),
  validationMiddleware(partnerSchemas.listingIdParamSchema),
  partnerHandlers.getSchedulesForListing
);

router.post(
  "/listings/:listingId/schedules",
  authMiddleware,
  roleCheck(["partner"]),
  validationMiddleware(partnerSchemas.createScheduleSchema),
  partnerHandlers.createSchedule
);

router.put(
  "/schedules/:scheduleId",
  authMiddleware,
  roleCheck(["partner"]),
  validationMiddleware(partnerSchemas.updateScheduleSchema),
  partnerHandlers.updateSchedule
);

router.delete(
  "/schedules/:scheduleId",
  authMiddleware,
  roleCheck(["partner"]),
  validationMiddleware(partnerSchemas.scheduleIdParamSchema),
  partnerHandlers.deleteSchedule
);

router.get(
  "/listings/:listingId/performance",
  authMiddleware,
  roleCheck(["partner"]),
  validationMiddleware(partnerSchemas.getListingPerformanceStatsSchema),
  partnerHandlers.getListingPerformanceStats
);

export default router; 