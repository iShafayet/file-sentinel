const constants = {
  CLIENT_IDENTFIER: "fs-official-1",
  META_FILE_PREFIX: ".__fs__",
  META_FILE_SUFFIX: ".json",
  PROGRESS_LOG_INTERVAL_MS: 1000,
  SYNC_HASHFILE_SIZE_THRESHOLD_BYTES: 10_000_000,
  crypto: {
    HASH_ALGO_SHA256: "sha256",
    SALT_BYTE_LEN: 128,
    ITERATION_COUNT: 10302,
    PASSWORD_DIGEST_KEYLEN: 512,
    DIGEST_ALGO: "sha256",
  },
};

export default constants;
