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
    status: Joi.string().valid("pending", "confirmed", "cancelled", "completed"),
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

export const webhookSchema = {
  body: Joi.object({
    gatewayTransactionId: Joi.string().required(),
    status: Joi.string().valid('succeeded', 'failed').required(),
  }),
};
