import Joi from "joi";

export type Operation = "untag"
  | "tag-new-only"
  | "tag-new-and-update-existing"
  | "prune"
  | "verify-integrity"
  | "verify-and-recover";

export type VerificationMode = "size" | "size-and-hash";

export type Config = {
  operation: Operation;
  target: {
    dir: string;
    metaDataDir: string | null;
  };
  hashRecheckThresholdMillis: number;
  verification: {
    mode: VerificationMode;
    hash: "sha256";
  };
  recovery: {
    mirrorDir: string;
    mirrorMetaDataDir: string | null;
    mirrorModificationTakesPrecedence: boolean;
    verifyAfterRecovery: boolean;
  } | null;
  panicOnError: boolean;
};

export const ConfigSchema = Joi.object({
  operation: Joi.string().valid("untag", "tag-new-only", "tag-new-and-update-existing", "prune", "verify-integrity", "verify-and-recover").required(),
  target: Joi.object({
    dir: Joi.string().required(),
    metaDataDir: Joi.string().allow(null).required(),
  }),
  hashRecheckThresholdMillis: Joi.number().min(0).required(),
  verification: Joi.object({
    mode: Joi.string().valid("size", "size-and-hash").required(),
    hash: Joi.string().valid("sha256").required(),
  }),
  recovery: Joi.object({
    mirrorDir: Joi.string().required(),
    mirrorMetaDataDir: Joi.string().optional(),
    mirrorModificationTakesPrecedence: Joi.boolean().required(),
    verifyAfterRecovery: Joi.boolean().required(),
  }).allow(null).required(),
  panicOnError: Joi.boolean().required(),
});
