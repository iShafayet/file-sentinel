import fs from "fs";
import { dirname, join, normalize } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const testEnv = join(__dirname, "../test/.env.test");
const distTestEnv = join(__dirname, "../dist/test/.env.test");

if (fs.existsSync(testEnv)) {
  fs.mkdirSync(dirname(distTestEnv), { recursive: true });
  fs.copyFileSync(testEnv, distTestEnv);
}
