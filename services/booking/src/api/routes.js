import { Router } from "express";
import { validationMiddleware, authMiddleware } from "@casablanca/common";
import * as bookingHandlers from "./handlers.js";
import * as bookingSchemas from "./validation.js";

const router = Router();

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

router.post(
  "/reservations/:id/pay",
  validationMiddleware(bookingSchemas.paymentSchema),
  bookingHandlers.submitPaymentForBooking
);

router.post(
  "/payment",
  validationMiddleware(bookingSchemas.paymentSchema),
  bookingHandlers.processPayment
);

export default router;