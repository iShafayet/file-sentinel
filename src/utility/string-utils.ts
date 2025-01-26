import { randomUUID } from "crypto";

let charset = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

const generateRandomString = (length: number) => {
  let result = "";
  for (let i = length; i > 0; --i) {
    result += charset[Math.floor(Math.random() * charset.length)];
  }
  return result;
};

let charset2 = "0123456789abcdefghijklmnopqrstuvwxyz";

const generateRandomStringCaseInsensitive = (length: number) => {
  let result = "";
  for (let i = length; i > 0; --i) {
    result += charset2[Math.floor(Math.random() * charset2.length)];
  }
  return result;
};

let charset3 =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/";

const generateRandomBase64String = (length: number) => {
  let result = "";
  for (let i = length; i > 0; --i) {
    result += charset3[Math.floor(Math.random() * charset.length)];
  }
  return result;
};

const generateUuid = () => {
  return randomUUID();
};

export {
  generateUuid,
  generateRandomString,
  generateRandomStringCaseInsensitive,
  generateRandomBase64String,
};
