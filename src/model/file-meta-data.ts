import Joi from "joi";

export type FileMetaData = {
  file: {
    name: string;
    size: number;
    createdAt: number;
    modifiedAt: number;
  };
  hash: {
    sha256: string;
  };
  verification: {
    lastVerifiedAt: number;
    lastVerifiedBy: string;
  };
  metaData: {
    approximateModifiedAt: number;
  };
};

export const fileMetaDataSchema = Joi.object({
  file: Joi.object({
    name: Joi.string().required(),
    size: Joi.number().required(),
    createdAt: Joi.number().required(),
    modifiedAt: Joi.number().required()
  }).required(),
  hash: Joi.object({
    sha256: Joi.string().required()
  }).required(),
  verification: Joi.object({
    lastVerifiedAt: Joi.number().required(),
    lastVerifiedBy: Joi.string().required()
  }).required(),
  metaData: Joi.object({
    approximateModifiedAt: Joi.number().required()
  }).required()
}).required();
