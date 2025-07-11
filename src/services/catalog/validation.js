import Joi from "joi";

const LATITUDE_REGEX = /^-?([1-8]?[1-9]|[1-9]0)\.{1}\d{1,6}$/;
const LONGITUDE_REGEX = /^-?((([1-9]?[0-9]|1[0-7][0-9])(\.\d{1,6})?)|180(\.0{1,6})?)$/;

// --- Reusable common schemas ---
const openingHoursSchema = Joi.object({
  openAt: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
  closeAt: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
});

// --- Metadata Schemas (Type-Specific) ---

const restaurantMetadataSchema = Joi.object({
  specialite: Joi.string().required(),
  menu: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    price: Joi.number().positive().required(),
    description: Joi.string().allow('').required(),
  })).min(1).required(),
});

const eventMetadataSchema = Joi.object({
  day: Joi.string().required(),
  time: Joi.string().required(),
  price: Joi.number().positive().required(),
  programme: Joi.array().items(Joi.object({
    heure: Joi.string().required(),
    detail: Joi.string().required(),
  })).min(1).required(),
});

const activityMetadataSchema = Joi.object({
  duration: Joi.string().required(),
  price: Joi.number().positive().required(),
  inclusions: Joi.array().items(Joi.string()).min(1).required(),
  nonInclus: Joi.array().items(Joi.string()).min(1).required(),
  programme: Joi.array().items(Joi.object({
    heure: Joi.string().required(),
    activite: Joi.string().required(),
  })).min(1).required(),
});

export const getListingsSchema = {
  query: Joi.object({
    q: Joi.string().trim().allow(""),
    category: Joi.string().trim(),
    lat: Joi.string().regex(LATITUDE_REGEX),
    lon: Joi.string().regex(LONGITUDE_REGEX),
    radius: Joi.number().integer().min(100).max(50000),
    priceMin: Joi.number().min(0),
    priceMax: Joi.number().min(Joi.ref('priceMin')),
    dateStart: Joi.date().iso(),
    dateEnd: Joi.date().iso().min(Joi.ref('dateStart')),
    amenities: Joi.string().trim(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
  }).with('lat', 'lon').with('lon', 'lat'),
};

export const getFeedSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),
};

export const createListingSchema = {
  body: Joi.object({
    // General Fields
    title: Joi.string().required(),
    description: Joi.string().required(),
    type: Joi.string().valid("ACTIVITY", "EVENT", "RESTAURANT").required(),
    address: Joi.string().required(),
    status: Joi.string().valid("PUBLISHED", "DRAFT", "ARCHIVED").default("DRAFT"),
    location: Joi.object({
      lat: Joi.number().required(),
      lon: Joi.number().required(),
    }).required(),
    phoneNumber: Joi.string().allow(null, ''),
    website: Joi.string().uri().allow(null, ''),
    openingHours: openingHoursSchema,
    workingDays: Joi.array().items(Joi.string()),
    categoryId: Joi.number().integer(),
    cancellationPolicy: Joi.string().allow(null, ''),
    accessibilityInfo: Joi.string().allow(null, ''),
    amenityIds: Joi.array().items(Joi.number().integer()),

    // Type-specific Metadata
    metadata: Joi.when('type', {
      is: 'RESTAURANT',
      then: restaurantMetadataSchema.required(),
      otherwise: Joi.when('type', {
        is: 'EVENT',
        then: eventMetadataSchema.required(),
        otherwise: Joi.when('type', {
          is: 'ACTIVITY',
          then: activityMetadataSchema.required(),
          otherwise: Joi.forbidden(),
        }),
      }),
    }),
  }),
};

export const updateListingSchema = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
  body: Joi.object({
    // General Fields
    title: Joi.string(),
    description: Joi.string(),
    type: Joi.string().valid("ACTIVITY", "EVENT", "RESTAURANT"),
    address: Joi.string(),
    location: Joi.object({
      lat: Joi.number().required(),
      lon: Joi.number().required(),
    }),
    phoneNumber: Joi.string().allow(null, ''),
    website: Joi.string().uri().allow(null, ''),
    openingHours: openingHoursSchema,
    workingDays: Joi.array().items(Joi.string()),
    categoryId: Joi.number().integer(),
    cancellationPolicy: Joi.string().allow(null, ''),
    accessibilityInfo: Joi.string().allow(null, ''),
    status: Joi.string().valid("PUBLISHED", "DRAFT", "ARCHIVED"),
    amenityIds: Joi.array().items(Joi.number().integer()),

    // Type-specific Metadata
    metadata: Joi.object(), // Allow partial updates on metadata
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

export const trendingAndNewListingSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(10),
  }),
};
