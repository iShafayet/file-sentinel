import { Command } from "./config.js";

/**
 * Execution result for all commands
 */
export type ExecutionResult = {
  command: Command;
  success: boolean;
  startedEpoch: number;
  completedEpoch: number;
  totalFilesProcessed: number;
  totalBytesProcessed: number;
  errorCount: number;
  errors: string[];

  // Digest specific
  filesAdded?: number;
  filesUpdated?: number;
  filesUnchanged?: number;
  filesDeleted?: number;

  // Verify specific
  filesVerified?: number;
  filesFailed?: number;
  filesMissing?: number;
  filesExtra?: number;

  // Replicate/Heal specific
  filesCopied?: number;
  filesRecovered?: number;
  filesRecoveryFailed?: number;
};

/**
 * Creates a new execution result with default values
 */
export function createExecutionResult(command: Command): ExecutionResult {
  return {
    command,
    success: false,
    startedEpoch: Date.now(),
    completedEpoch: 0,
    totalFilesProcessed: 0,
    totalBytesProcessed: 0,
    errorCount: 0,
    errors: [],
  };
}

/**
 * Adds an error to the execution result
 */
export function addError(result: ExecutionResult, error: string): void {
  result.errors.push(error);
  result.errorCount++;
}

/**
 * Marks the execution as completed
 */
export function completeExecution(result: ExecutionResult, success: boolean): void {
  result.completedEpoch = Date.now();
  result.success = success;
}
