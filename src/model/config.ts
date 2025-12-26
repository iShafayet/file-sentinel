import Joi from "joi";

// Command types
export type Command = "digest" | "verify" | "replicate" | "heal";

// Base config with common options
type BaseConfig = {
  verbose: boolean;
  panicOnError: boolean;
  dryRun: boolean;
  ioTimeout: number;
  noTty: boolean;
  hashAlgorithm: "sha256";
};

// Digest command config
export type DigestConfig = BaseConfig & {
  command: "digest";
  inputDir: string;
  digestFile: string;
};

// Verify command config
export type VerifyConfig = BaseConfig & {
  command: "verify";
  inputDir: string;
  digestFile: string;
  subdirectory: string | null;
};

// Replicate command config
export type ReplicateConfig = BaseConfig & {
  command: "replicate";
  sourceDir: string;
  sourceDigestFile: string;
  destDir: string;
  destDigestFile: string;
  subdirectory: string | null;
  mirrors: Array<{ dir: string; digestFile: string }>;
  permaDelete: boolean;
  validatePostCopy: boolean;
};

// Heal command config
export type HealConfig = BaseConfig & {
  command: "heal";
  inputDir: string;
  digestFile: string;
  subdirectory: string | null;
  mirrors: Array<{ dir: string; digestFile: string }>;
  validatePostCopy: boolean;
};

// Union type for all configs
export type Config = DigestConfig | VerifyConfig | ReplicateConfig | HealConfig;

// Validation schemas
const baseConfigSchema = {
  verbose: Joi.boolean().required(),
  panicOnError: Joi.boolean().required(),
  dryRun: Joi.boolean().required(),
  ioTimeout: Joi.number().min(1).required(),
  hashAlgorithm: Joi.string().valid("sha256").required(),
};

export const DigestConfigSchema = Joi.object({
  command: Joi.string().valid("digest").required(),
  inputDir: Joi.string().required(),
  digestFile: Joi.string().required(),
  ...baseConfigSchema,
});

export const VerifyConfigSchema = Joi.object({
  command: Joi.string().valid("verify").required(),
  inputDir: Joi.string().required(),
  digestFile: Joi.string().required(),
  subdirectory: Joi.string().allow(null).required(),
  ...baseConfigSchema,
});

export const ReplicateConfigSchema = Joi.object({
  command: Joi.string().valid("replicate").required(),
  sourceDir: Joi.string().required(),
  sourceDigestFile: Joi.string().required(),
  destDir: Joi.string().required(),
  destDigestFile: Joi.string().required(),
  subdirectory: Joi.string().allow(null).required(),
  mirrors: Joi.array()
    .items(
      Joi.object({
        dir: Joi.string().required(),
        digestFile: Joi.string().required(),
      })
    )
    .required(),
  permaDelete: Joi.boolean().required(),
  validatePostCopy: Joi.boolean().required(),
  ...baseConfigSchema,
});

export const HealConfigSchema = Joi.object({
  command: Joi.string().valid("heal").required(),
  inputDir: Joi.string().required(),
  digestFile: Joi.string().required(),
  subdirectory: Joi.string().allow(null).required(),
  mirrors: Joi.array()
    .items(
      Joi.object({
        dir: Joi.string().required(),
        digestFile: Joi.string().required(),
      })
    )
    .min(1)
    .required(),
  validatePostCopy: Joi.boolean().required(),
  ...baseConfigSchema,
});

export const ConfigSchema = Joi.alternatives().try(
  DigestConfigSchema,
  VerifyConfigSchema,
  ReplicateConfigSchema,
  HealConfigSchema
);
