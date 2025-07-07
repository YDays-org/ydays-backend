import Joi from 'joi';

export const uploadMedia = Joi.object({
  body: Joi.object({
    listingId: Joi.string().uuid().required(),
    captions: Joi.alternatives().try(
      Joi.string().max(500).allow(''),
      Joi.array().items(Joi.string().max(500).allow(''))
    ).optional(),
    isCover: Joi.boolean().default(false),
  }),
});