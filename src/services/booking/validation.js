import Joi from "joi";

export const getAvailabilitySchema = {
  query: Joi.object({
    listingId: Joi.string().uuid().required(),
    date: Joi.date().iso().required(),
  }),
};

export const createBookingSchema = {
  body: Joi.object({
    scheduleId: Joi.string().uuid().required(),
    numParticipants: Joi.number().integer().min(1).required(),
  }),
};

export const getBookingsSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    status: Joi.string().valid("pending", "confirmed", "cancelled", "completed", "awaiting_payment"),
  }),
};

export const bookingIdParamSchema = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
};

export const updateBookingSchema = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
  body: Joi.object({
    numParticipants: Joi.number().integer().min(1).required(),
  }),
};

export const paymentSchema = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
  body: Joi.object({
    cardNumber: Joi.string().creditCard().required(),
    expiryMonth: Joi.string().length(2).required(),
    expiryYear: Joi.string().length(4).required(),
    cvc: Joi.string().min(3).max(4).required(),
  })
};

export const stripePaymentSchema = {
  body: Joi.object({
    amount: Joi.number().integer().min(1).required(),
    currency: Joi.string().length(3).required(),
  }),
};
