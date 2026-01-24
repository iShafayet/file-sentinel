import fs from "fs";
import constants from "../constant/common-constants.js";
import { logger } from "../lib/logger.js";

class FileService {
  verifyDirectoryExists(dir: string): boolean {
    return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
  }

  verifyFileExists(file: string): boolean {
    return fs.existsSync(file) && fs.statSync(file).isFile();
  }

  async copyLargeFile(
    source: string,
    destination: string,
    updateProgressFn: (bytesRead: number, totalBytes: number) => void
  ): Promise<void> {
    return await new Promise<void>((resolve, reject) => {
      try {
        // Get file size for progress calculation
        const stats = fs.statSync(source);
        const totalBytes = stats.size;

        const readStream = fs.createReadStream(source);
        const writeStream = fs.createWriteStream(destination);
        let totalBytesRead = 0;
        let lastProgressLogTime = 0;
        let finished = false;

        readStream.on("data", (chunk: Buffer) => {
          totalBytesRead += chunk.length;
          
          // Handle backpressure: if write() returns false, the stream's buffer is full
          // Pause reading until the 'drain' event is emitted
          const canContinue = writeStream.write(chunk);
          if (!canContinue) {
            readStream.pause();
          }

          if (Date.now() - lastProgressLogTime >= constants.PROGRESS_LOG_INTERVAL_MS) {
            lastProgressLogTime = Date.now();
            updateProgressFn(totalBytesRead, totalBytes);
          }
        });

        // Resume reading when the write stream's buffer is drained
        writeStream.on("drain", () => {
          readStream.resume();
        });

        readStream.on("end", () => {
          // End the write stream after all data has been written
          writeStream.end();
          updateProgressFn(totalBytesRead, totalBytes);
        });
        readStream.on("error", (err: Error) => {
          if (!finished) {
            finished = true;
            logger.logNegative("(file-service)> Error copying file:", err.message);
            writeStream.destroy();
            reject(err);
          }
        });
        writeStream.on("error", (err: Error) => {
          if (!finished) {
            finished = true;
            logger.logNegative("(file-service)> Error copying file:", err.message);
            readStream.destroy();
            reject(err);
          }
        });
        writeStream.on("finish", () => {
          if (!finished) {
            finished = true;
            resolve();
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }
}

export const fileService = new FileService();
