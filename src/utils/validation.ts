import Joi from "joi";

export const donationSchemaJoi = Joi.object({
  userId: Joi.string().required(),
  campaignId: Joi.string().required(),
  amount: Joi.number().required().positive().greater(0),
  reference: Joi.string().required(),
  paymentStatus: Joi.string().required(),
});

export const campaignSchemaJoi = Joi.object({
  title: Joi.string().required(),
  slug: Joi.string().required(),
  description: Joi.string().required(),
  medias: Joi.array().length(3), //
  currentPrice: Joi.number().required().min(0),
  priceTarget: Joi.number().required().positive().greater(0),
  startDate: Joi.date().required(),
  endDate: Joi.date().required(),
  status: Joi.boolean().required(),
  statusReason: Joi.string(),
});
