import { Router } from "express";
import { validationMiddleware } from "../../common/middlewares/validation.js";
import * as bookingHandlers from "./handlers.js";
import * as bookingSchemas from "./validation.js";
import { authMiddleware } from "../../common/middlewares/auth.js";

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
  validationMiddleware(bookingSchemas.createPaymentIntentSchema),
  bookingHandlers.processPayment
);

router.post(
  "/payment/complete",
  validationMiddleware(bookingSchemas.completePaymentSchema),
  bookingHandlers.completePayment
);

export default router;
