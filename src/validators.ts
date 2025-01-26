import Joi from "joi";

export const validators = {
  id: Joi.string().length(16).required(),

  directoryName: Joi.string().min(1).max(256).required(),
  fileName: Joi.string().min(1).max(256).required(),

  hasErrorFalsy: Joi.boolean().valid(false).required(),
  hasErrorTruthy: Joi.boolean().valid(true).required(),

  dateRequired: Joi.number().required(),
  dateRequiredNullable: Joi.number().required().allow(null),
};
