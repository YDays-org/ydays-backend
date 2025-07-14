import Joi from "joi";

export const createReviewSchema = {
  body: Joi.object({
    bookingId: Joi.string().uuid().required(),
    rating: Joi.number().integer().min(1).max(5).required(),
    comment: Joi.string().trim().allow(""),
  }),
};

export const getReviewsSchema = {
  params: {
    listingId: Joi.string().uuid().required(),
  },
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
  }),
};

export const addReplySchema = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
  body: Joi.object({
    reply: Joi.string().trim().required(),
  }),
};
