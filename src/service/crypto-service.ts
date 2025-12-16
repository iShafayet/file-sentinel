import { logger } from "../lib/logger.js";

import fs from "fs";
import path from "path";
import crypto from "crypto";
import constants from "../constant/common-constants.js";

// Progress reporting interval: 10 seconds
const HASH_PROGRESS_INTERVAL_MS = 10_000;

class CryptoService {
  generateSha256HashFromFile(
    filePath: string,
    size: number,
    updateProgressFn: (bytesRead: number) => void
  ): Promise<string> {
    if (size <= constants.SYNC_HASHFILE_SIZE_THRESHOLD_BYTES) {
      return Promise.resolve(this.generateSha256HashFromFileSync(filePath));
    } else {
      return this.generateSha256HashFromFileAsync(filePath, updateProgressFn);
    }
  }

  private generateSha256HashFromFileSync(filePath: string): string {
    const hash = crypto.createHash("sha256");
    const fileBuffer = fs.readFileSync(filePath);
    hash.update(fileBuffer);
    return hash.digest("hex");
  }

  private generateSha256HashFromFileAsync(
    filePath: string,
    updateProgressFn: (bytesRead: number) => void
  ): Promise<string> {
    const hash = crypto.createHash("sha256");
    const readStream = fs.createReadStream(filePath);
    let totalBytesRead = 0;
    let lastProgressLogTime = 0;

    return new Promise<string>((resolve, reject) => {
      readStream.on("data", (chunk: Buffer) => {
        hash.update(chunk);
        totalBytesRead += chunk.length;
        if (Date.now() - lastProgressLogTime >= constants.PROGRESS_LOG_INTERVAL_MS) {
          lastProgressLogTime = Date.now();
          updateProgressFn(totalBytesRead);
        }
      });

      readStream.on("end", () => {
        resolve(hash.digest("hex"));
        updateProgressFn(totalBytesRead);
      });

      readStream.on("error", (err: Error) => {
        reject(err);
      });
    });
  }

  /**
   * Formats bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  /**
   * Convenience method for v2 - hashes a file using the specified algorithm
   * Shows progress every 10 seconds (only for files that take longer than 10 seconds to hash)
   */
  async hashFile(filePath: string, algorithm: "sha256"): Promise<string> {
    const stats = fs.statSync(filePath);
    const size = stats.size;
    const fileName = path.basename(filePath);
    const startTime = Date.now();
    let lastLogTime = startTime;

    const progressFn = (bytesRead: number) => {
      const now = Date.now();
      const elapsed = now - startTime;

      // Only log progress after 10 seconds have elapsed, and then every 10 seconds
      if (elapsed >= HASH_PROGRESS_INTERVAL_MS && now - lastLogTime >= HASH_PROGRESS_INTERVAL_MS) {
        lastLogTime = now;
        const percentage = Math.floor((bytesRead / size) * 100);
        const bytesReadStr = this.formatBytes(bytesRead);
        const totalStr = this.formatBytes(size);
        logger.log(`(crypto-service)> Hashing "${fileName}": ${bytesReadStr}/${totalStr} (${percentage}%)`);
      }
    };

    return this.generateSha256HashFromFile(filePath, size, progressFn);
  }
}

export const cryptoService = new CryptoService();