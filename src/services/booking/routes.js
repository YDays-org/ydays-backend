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

router.get(
  "/reservations/all",
  bookingHandlers.getAllReservations
);

// All subsequent routes require authentication
router.use(authMiddleware);

router.post(
  "/reservations",
  authMiddleware,
  validationMiddleware(bookingSchemas.createBookingSchema),
  bookingHandlers.createReservation
);

router.get(
  "/reservations",
  authMiddleware,
  validationMiddleware(bookingSchemas.getBookingsSchema),
  bookingHandlers.getReservations
);

router.get(
  "/reservations/:id",
  authMiddleware,
  validationMiddleware(bookingSchemas.bookingIdParamSchema),
  bookingHandlers.getReservationById
);

router.patch(
  "/reservations/:id",
  authMiddleware,
  validationMiddleware(bookingSchemas.updateBookingSchema),
  bookingHandlers.updateReservation
);

router.patch(
  "/reservations/:id/cancel",
  authMiddleware,
  validationMiddleware(bookingSchemas.bookingIdParamSchema),
  bookingHandlers.cancelReservation
);

router.post(
  "/reservations/:id/pay",
  authMiddleware,
  validationMiddleware(bookingSchemas.paymentSchema),
  bookingHandlers.submitPaymentForBooking
);

router.post(
  "/payment",
  authMiddleware,
  validationMiddleware(bookingSchemas.createPaymentIntentSchema),
  bookingHandlers.processPayment
);

router.post(
  "/payment/complete",
  authMiddleware,
  validationMiddleware(bookingSchemas.completePaymentSchema),
  bookingHandlers.completePayment
);

export default router;
