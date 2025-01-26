import stream, { Transform } from "stream";
import { CodedError } from "./coded-error.js";

export const createSizeLimiterPassthroughStream = (sizeLimit: number, byteCountWrapper: any) => {
  byteCountWrapper.byteCount = 0;
  const sizeLimiter = new stream.Transform({
    transform: function transformer(chunk, encoding, callback) {
      byteCountWrapper.byteCount += chunk.length;

      if (byteCountWrapper.byteCount > sizeLimit) {
        callback(new CodedError("BLOB_SIZE_EXCEEDS_LIMIT", "Rejected attempt to write file larger than allowed"));
        return;
      }

      callback(null, chunk);
    },
  });
  return sizeLimiter;
};

export const createDelayerTransformStream = (duration: number) => {
  return new Transform({
    transform(chunk, encoding, callback) {
      setTimeout(() => {
        callback(null, chunk);
      }, duration);
    },
  });
};
