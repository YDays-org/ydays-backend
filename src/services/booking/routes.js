import { Router } from "express";
import { validationMiddleware } from "../../common/middlewares/validation.js";
import * as bookingHandlers from "./handlers.js";
import * as bookingSchemas from "./validation.js";

const router = Router();

router.get(
  "/availability",
  validationMiddleware(bookingSchemas.getAvailabilitySchema),
  bookingHandlers.getAvailability
);

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
  "/reservations/:id/cancel",
  validationMiddleware(bookingSchemas.bookingIdParamSchema),
  bookingHandlers.cancelReservation
);

export default router;
