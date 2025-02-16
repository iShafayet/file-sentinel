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

    const operationNameMap: Record<Operation, string> = {
      "tag-new-only": "Tagging new files only",
      "tag-new-and-update-existing": "Tagging new and updating existing files",
      "untag": "Untagging files",
      "verify-integrity": "Verifying integrity",
      "prune": "Pruning files",
      "verify-and-recover": "Verifying and recovering files",
    };
    const prettyOperation = operationNameMap[operation] || operation;

    const totalCount = executionResult.totalCount;
    const errorCount = executionResult.errorCount;

    const successCount = 0;

    const runningTimeString = this.getFormattedRunningTime(executionResult.startedEpoch);

    const message = `${prettyOperation} - Total: ${totalCount}, Error: ${errorCount}, Success: ${successCount}, Time Elapsed: ${runningTimeString}`;

    logger.log(message);
  }
}

export const uxService = new UxService();
