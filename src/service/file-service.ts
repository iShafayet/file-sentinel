import fs from "fs";

class FileService {

  verifyDirectoryExists(dir: string): boolean {
    return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
  }

  verifyFileExists(file: string): boolean {
    return fs.existsSync(file) && fs.statSync(file).isFile();
  }
}

export const fileService = new FileService();