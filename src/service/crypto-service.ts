import { logger } from "../lib/logger.js";

import fs from 'fs';
import crypto from 'crypto';
import constants from "../constant/common-constants.js";

class CryptoService {

  generateSha256HashFromFile(filePath: string, size: number, updateProgressFn: (bytesRead: number) => void): Promise<string> {
    if (size <= constants.SYNC_HASHFILE_SIZE_THRESHOLD_BYTES) {
      return Promise.resolve(this.generateSha256HashFromFileSync(filePath));
    } else {
      return this.generateSha256HashFromFileAsync(filePath, updateProgressFn);
    }
  }

  private generateSha256HashFromFileSync(filePath: string): string {
    const hash = crypto.createHash('sha256');
    const fileBuffer = fs.readFileSync(filePath);
    hash.update(fileBuffer);
    return hash.digest('hex');
  }

  private generateSha256HashFromFileAsync(filePath: string, updateProgressFn: (bytesRead: number) => void): Promise<string> {
    const hash = crypto.createHash('sha256');
    const readStream = fs.createReadStream(filePath);
    let totalBytesRead = 0;
    let lastProgressLogTime = 0;

    return new Promise<string>((resolve, reject) => {
      readStream.on('data', (chunk: Buffer) => {
        hash.update(chunk);
        totalBytesRead += chunk.length;
        if (Date.now() - lastProgressLogTime >= constants.PROGRESS_LOG_INTERVAL_MS) {
          lastProgressLogTime = Date.now();
          updateProgressFn(totalBytesRead);
        }
      });

      readStream.on('end', () => {
        resolve(hash.digest('hex'));
        updateProgressFn(totalBytesRead);
      });

      readStream.on('error', (err: Error) => {
        reject(err);
      });
    });
  }

}

export const cryptoService = new CryptoService();