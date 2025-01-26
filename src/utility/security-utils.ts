import cryptolib from "crypto";
import constants from "../constant/common-constants.js";

const makeSalt = () => {
  return cryptolib
    .randomBytes(constants.crypto.SALT_BYTE_LEN)
    .toString("base64");
};

const makeHash = (string: string, salt: string, iterations: number) => {
  return cryptolib
    .pbkdf2Sync(
      string,
      salt,
      iterations,
      constants.crypto.PASSWORD_DIGEST_KEYLEN,
      constants.crypto.DIGEST_ALGO
    )
    .toString("hex");
};

const calculateHashOfString = (string: string) => {
  let salt = makeSalt();
  let iterations = constants.crypto.ITERATION_COUNT;
  let hash = makeHash(string, salt, iterations);
  return { hash, salt };
};

const compareHashWithString = (
  string: string,
  salt: string,
  hashToCompareWith: string
) => {
  let iterations = constants.crypto.ITERATION_COUNT;
  let newHash = makeHash(string, salt, iterations);
  return newHash === hashToCompareWith;
};

export { calculateHashOfString, compareHashWithString };
