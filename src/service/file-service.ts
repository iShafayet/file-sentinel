import fs from "fs";
import constants from "../constant/common-constants.js";
class FileService {

  verifyDirectoryExists(dir: string): boolean {
    return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
  }

  verifyFileExists(file: string): boolean {
    return fs.existsSync(file) && fs.statSync(file).isFile();
  }

  async copyLargeFile(source: string, destination: string, updateProgressFn: (bytesRead: number) => void): Promise<void> {
    return await new Promise<void>((resolve, reject) => {
      try {
        const readStream = fs.createReadStream(source);
        const writeStream = fs.createWriteStream(destination);
        let totalBytesRead = 0;
        let lastProgressLogTime = 0;
        readStream.on('data', (chunk: Buffer) => {
          writeStream.write(chunk);
          totalBytesRead += chunk.length;
          if (Date.now() - lastProgressLogTime >= constants.PROGRESS_LOG_INTERVAL_MS) {
            lastProgressLogTime = Date.now();
            updateProgressFn(totalBytesRead);
          }
        });
        readStream.on('end', () => {
          writeStream.end();
          updateProgressFn(totalBytesRead);
          resolve();
        });
        readStream.on('error', (err: Error) => {
          console.error('Error copying file:', err);
          reject(err);
        });
        writeStream.on('error', (err: Error) => {
          console.error('Error copying file:', err);
          reject(err);
        });
        writeStream.on('close', () => {
          resolve();
        });
      } catch (err) {
        reject(err);
      }
    });
  }
}

export const fileService = new FileService();