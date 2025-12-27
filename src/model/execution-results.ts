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

  // Compare specific (predicts what replicate would do: local -> remote)
  filesToBeCreated?: number; // Files in local but not in remote (would be created)
  filesToBeUpdated?: number; // Files in both but with different hash (would be updated)
  filesToBeDeleted?: number; // Files in remote but not in local (would be deleted)
};
