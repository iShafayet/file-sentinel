import { FileSentinelProgram } from "../src/index.js";

export type TestFile = {
  path: string;
  sizeInBytes: number;
};
declare global {
  var testDataDir: string;
  var fileSentinelList: FileSentinelProgram[];

}
