import { Router } from "express";
import { validationMiddleware } from "../../common/middlewares/validation.js";
import { roleCheck } from "../../common/middlewares/roles.js";
import * as partnerHandlers from "./handlers.js";
import * as partnerSchemas from "./validation.js";
import { authMiddleware } from "../../common/middlewares/auth.js";

const router = Router();

router.use(authMiddleware);

router.get(
  "/bookings",
  roleCheck(["partner"]),
  validationMiddleware(partnerSchemas.getPartnerBookingsSchema),
  partnerHandlers.getPartnerBookings
);

router.get(
  "/bookings/:id",
  roleCheck(["partner"]),
  validationMiddleware(partnerSchemas.bookingIdParamSchema),
  partnerHandlers.getPartnerBookingById
);

router.get(
  "/stats",
  roleCheck(["partner"]),
  validationMiddleware(partnerSchemas.getStatsSchema),
  partnerHandlers.getPartnerDashboardStats
);

router.patch(
  "/bookings/:id/cancel",
  roleCheck(["partner"]),
  validationMiddleware(partnerSchemas.bookingIdParamSchema),
  partnerHandlers.cancelReservationByPartner
);

router.post(
  "/promotions",
  roleCheck(["partner"]),
  validationMiddleware(partnerSchemas.createPromotionSchema),
  partnerHandlers.createPromotion
);

router.get(
  "/promotions",
  roleCheck(["partner"]),
  partnerHandlers.getPromotions
);

router.post(
  "/promotions/:promotionId/apply",
  roleCheck(["partner"]),
  validationMiddleware(partnerSchemas.applyPromotionSchema),
  partnerHandlers.applyPromotionToListings
);

export default router; 