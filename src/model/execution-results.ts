import { Operation } from "./config.js";

export type ExecutionResult = {
  operation: Operation;
  success: boolean;
  errorCount: number;

  tagRemovedCount?: number;
  tagAddedCount?: number;
  tagUpdatedCount?: number;

  prunedCount?: number;
  verificationPassedCount?: number;
  verificationFailedCount?: number;
  verificationSkippedCount?: number;

  recoveredCount?: number;
};
