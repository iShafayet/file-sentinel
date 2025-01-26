import Joi from "joi";

export type Operation = "tag-new" | "update-tags" | "verify-integrity" | "verify-and-recover";

export type VerificationMode = "size" | "size-and-hash";

export type Config = {
  operation: Operation;
  target: {
    dir: string;
    metaDataDir: string | null;
  };
  verification: {
    mode: VerificationMode;
    hash: "sha256";
  };
  recovery: {
    mirrorDir: string;
    mirrorMetaDataDir: string | null;
    verifyAfterRecovery: boolean;
  };
};

export const ConfigSchema = Joi.object({
  operation: Joi.string().valid("tag-new", "update-tags", "verify-integrity", "verify-and-recover").required(),
  target: Joi.object({
    dir: Joi.string().required(),
    metaDataDir: Joi.string().optional(),
  }),
  verification: Joi.object({
    mode: Joi.string().valid("size", "size-and-hash").required(),
    hash: Joi.string().valid("sha256").required(),
  }),
  recovery: Joi.object({
    mirrorDir: Joi.string().required(),
    mirrorMetaDataDir: Joi.string().optional(),
    verifyAfterRecovery: Joi.boolean().required(),
  }),
});
