import Joi from "joi";

const LATITUDE_REGEX = /^-?([1-8]?[1-9]|[1-9]0)\.{1}\d{1,6}$/;
const LONGITUDE_REGEX = /^-?((([1-9]?[0-9]|1[0-7][0-9])(\.\d{1,6})?)|180(\.0{1,6})?)$/;

export const getListingsSchema = {
  query: Joi.object({
    q: Joi.string().trim().allow(""),
    category: Joi.string().trim(),
    lat: Joi.string().regex(LATITUDE_REGEX),
    lon: Joi.string().regex(LONGITUDE_REGEX),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
  }),
};

export const createListingSchema = {
  body: Joi.object({
    title: Joi.string().required(),
    description: Joi.string().required(),
    type: Joi.string().valid("activity", "event", "restaurant").required(),
    address: Joi.string().required(),
    location: Joi.object({
      lat: Joi.number().required(),
      lon: Joi.number().required(),
    }).required(),
    categoryId: Joi.number().integer(),
    openingHours: Joi.object(),
    cancellationPolicy: Joi.string(),
    accessibilityInfo: Joi.string(),
    amenityIds: Joi.array().items(Joi.number().integer()),
  }),
};

export const updateListingSchema = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
  body: Joi.object({
    title: Joi.string(),
    description: Joi.string(),
    type: Joi.string().valid("activity", "event", "restaurant"),
    address: Joi.string(),
    location: Joi.object({
      lat: Joi.number().required(),
      lon: Joi.number().required(),
    }),
    categoryId: Joi.number().integer(),
    openingHours: Joi.object(),
    cancellationPolicy: Joi.string(),
    accessibilityInfo: Joi.string(),
    status: Joi.string().valid("published", "draft", "archived"),
    isPromoted: Joi.boolean(),
    amenityIds: Joi.array().items(Joi.number().integer()),
  }).min(1),
};

export const listingIdParamSchema = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
};

export const favoriteParamSchema = {
  params: Joi.object({
    listingId: Joi.string().uuid().required(),
  }),
};
