import { Operation } from "./config.js";

export type ExecutionResult = {
  operation: Operation;
  success: boolean;
  errorCount: number;

  // For all operations
  totalCount: number;
  startedEpoch: number;
  completedEpoch: number;

  // For tag-new-only, tag-new-and-update-existing, untag
  tagAddedCount: number;
  tagUpdatedCount: number;
  tagSkippedCount: number;
  tagRemovedCount: number;

  // For verify-integrity
  verificationPassedCount: number;
  verificationFailedCount: number;
  verificationSkippedCount: number;

  // For verify-and-recover
  recoverySuccessfulCount: number;
  recoveryFailedCount: number;

  // For prune
  prunedTagCount: number;
};

export function makeExecutionResult(operation: Operation): ExecutionResult {
  return {
    operation,
    success: true,
    errorCount: 0,
    totalCount: 0,
    startedEpoch: Date.now(),
    completedEpoch: 0,
    tagAddedCount: 0,
    tagUpdatedCount: 0,
    tagSkippedCount: 0,
    tagRemovedCount: 0,
    verificationPassedCount: 0,
    verificationFailedCount: 0,
    verificationSkippedCount: 0,
    recoverySuccessfulCount: 0,
    recoveryFailedCount: 0,
    prunedTagCount: 0,
  };
}

