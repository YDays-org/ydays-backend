import Joi from "joi";

export const getPartnerBookingsSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    status: Joi.string().valid("PENDING", "CONFIRMED", "CANCELLED", "COMPLETED", "AWAITING_PAYMENT"),
    listingId: Joi.string().uuid(),
  }),
};

export const bookingIdParamSchema = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
};

export const listingIdParamSchema = {
  params: Joi.object({
    listingId: Joi.string().uuid().required(),
  }),
};

export const scheduleIdParamSchema = {
  params: Joi.object({
    scheduleId: Joi.string().uuid().required(),
  }),
};

export const createScheduleSchema = {
  params: Joi.object({
    listingId: Joi.string().uuid().required(),
  }),
  body: Joi.object({
    startTime: Joi.date().iso().required(),
    endTime: Joi.date().iso().required(),
    price: Joi.number().precision(2).min(0).required(),
    capacity: Joi.number().integer().min(1).required(),
    isAvailable: Joi.boolean().default(true),
  }),
};

export const updateScheduleSchema = {
  params: Joi.object({
    scheduleId: Joi.string().uuid().required(),
  }),
  body: Joi.object({
    startTime: Joi.date().iso(),
    endTime: Joi.date().iso(),
    price: Joi.number().precision(2).min(0),
    capacity: Joi.number().integer().min(1),
    isAvailable: Joi.boolean(),
  }).min(1),
};

export const getStatsSchema = {
  query: Joi.object({
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')),
  }),
};

export const createPromotionSchema = {
  body: Joi.object({
    name: Joi.string().required(),
    description: Joi.string().allow(null, ''),
    type: Joi.string().valid('PERCENTAGE_DISCOUNT', 'FIXED_AMOUNT_DISCOUNT', 'VISIBILITY_BOOST').required(),
    value: Joi.number().min(0).required(),
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
    isActive: Joi.boolean().default(true),
  }),
};

export const applyPromotionSchema = {
  params: Joi.object({
    promotionId: Joi.string().uuid().required(),
  }),
  body: Joi.object({
    listingIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
  }),
};

export const promotionIdParamSchema = {
  params: Joi.object({
    promotionId: Joi.string().uuid().required(),
  }),
};

export const getListingPerformanceStatsSchema = {
  params: Joi.object({
    listingId: Joi.string().uuid().required(),
  }),
  query: Joi.object({
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
  }),
}; 