import Joi from "joi";

export const getNotificationsSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),
};

export const notificationIdParamSchema = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
};
