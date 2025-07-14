import Joi from "joi";

// --- Category Schemas ---
export const createCategorySchema = {
  body: Joi.object({
    name: Joi.string().required(),
    slug: Joi.string().required(),
  }),
};

export const updateCategorySchema = {
  params: Joi.object({
    id: Joi.number().integer().required(),
  }),
  body: Joi.object({
    name: Joi.string(),
    slug: Joi.string(),
  }).min(1),
};

export const categoryIdParamSchema = {
  params: Joi.object({
    id: Joi.number().integer().required(),
  }),
};


// --- Amenity Schemas ---
export const createAmenitySchema = {
  body: Joi.object({
    name: Joi.string().required(),
    iconUrl: Joi.string().uri().allow(null, ''),
  }),
};

export const updateAmenitySchema = {
  params: Joi.object({
    id: Joi.number().integer().required(),
  }),
  body: Joi.object({
    name: Joi.string(),
    iconUrl: Joi.string().uri().allow(null, ''),
  }).min(1),
};

export const amenityIdParamSchema = {
  params: Joi.object({
    id: Joi.number().integer().required(),
  }),
};

// --- User Management Schemas ---
export const listUsersSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),
};
export const userIdParamSchema = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
};

export const updateUserRoleSchema = {
  params: Joi.object({
    userId: Joi.string().required(),
  }),
  body: Joi.object({
    role: Joi.string().valid("CUSTOMER", "PARTNER", "ADMIN").required(),
  }),
}; 