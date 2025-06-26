import express, { Router } from "express";
import { validationMiddleware } from "../../common/middlewares/validation.js";
import * as bookingHandlers from "./handlers.js";
import * as bookingSchemas from "./validation.js";
import { authMiddleware } from "../../common/middlewares/auth.js";

const router = Router();
export const webhookRouter = Router();

// Stripe webhook needs raw body
webhookRouter.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  bookingHandlers.handleStripeWebhook
);

router.get(
  "/availability",
  validationMiddleware(bookingSchemas.getAvailabilitySchema),
  bookingHandlers.getAvailability
);

// All subsequent routes require authentication
router.use(authMiddleware);

router.post(
  "/reservations",
  validationMiddleware(bookingSchemas.createBookingSchema),
  bookingHandlers.createReservation
);

router.get(
  "/reservations",
  validationMiddleware(bookingSchemas.getBookingsSchema),
  bookingHandlers.getReservations
);

router.get(
  "/reservations/:id",
  validationMiddleware(bookingSchemas.bookingIdParamSchema),
  bookingHandlers.getReservationById
);

router.patch(
  "/reservations/:id",
  validationMiddleware(bookingSchemas.updateBookingSchema),
  bookingHandlers.updateReservation
);

router.patch(
  "/reservations/:id/cancel",
  validationMiddleware(bookingSchemas.bookingIdParamSchema),
  bookingHandlers.cancelReservation
);

export default router;
