import { ExecutionResult } from "../model/execution-results.js";
import { Operation } from "../model/config.js";
import constants from "../constant/common-constants.js";
import { logger } from "../lib/logger.js";

let lastProgressLogTime = 0;

class UxService {

  private getFormattedRunningTime(startedEpoch: number): string {
    const now = Date.now();
    const runningTime = now - startedEpoch;
    const hours = Math.floor(runningTime / (1000 * 60 * 60));
    const minutes = Math.floor((runningTime % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((runningTime % (1000 * 60)) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  public logProgress(executionResult: ExecutionResult) {
    const now = Date.now();
    if (now - lastProgressLogTime < constants.UX_PROGRESS_LOG_INTERVAL_MS) {
      return;
    }
    lastProgressLogTime = now;

    const operation = executionResult.operation;

    const totalCount = executionResult.totalCount;
    const errorCount = executionResult.errorCount;

    const runningTimeString = this.getFormattedRunningTime(executionResult.startedEpoch);

    let message = "";
    if (operation === "tag-new-only") {
      message = `Operation: "${operation}" - Completed: ${executionResult.tagAddedCount}/${totalCount}, Errors: ${errorCount}, Time Elapsed: ${runningTimeString}`;
    } else if (operation === "tag-new-and-update-existing") {
      const completedCount = (executionResult.tagAddedCount || 0) + (executionResult.tagUpdatedCount || 0) + (executionResult.tagSkippedCount || 0);
      message = `Operation: "${operation}" - Completed: ${completedCount}/${totalCount}, Errors: ${errorCount}, Time Elapsed: ${runningTimeString}`;
    } else if (operation === "untag") {
      message = `Operation: "${operation}" - Removed so far: ${executionResult.tagRemovedCount}, Errors: ${errorCount}, Time Elapsed: ${runningTimeString}`;
    } else if (operation === "verify-integrity") {
      message = `Operation: "${operation}" - Completed: ${executionResult.verificationPassedCount}/${totalCount}, Errors: ${errorCount}, Time Elapsed: ${runningTimeString}`;
    } else if (operation === "prune") {
      message = `Operation: "${operation}" - Completed: ${executionResult.prunedTagCount}/${totalCount}, Errors: ${errorCount}, Time Elapsed: ${runningTimeString}`;
    } else if (operation === "verify-and-recover") {
      message = `Operation: "${operation}" - Total: ${totalCount}, Recovery Successful: ${executionResult.recoverySuccessfulCount}, Recovery Failed: ${executionResult.recoveryFailedCount}, Errors: ${errorCount}, Time Elapsed: ${runningTimeString}`;
    } else {
      message = `Operation: "${operation}" - Total: ${totalCount}, Errors: ${errorCount}, Time Elapsed: ${runningTimeString}`;
    }

    logger.log(message);
  }
}

export const uxService = new UxService();
