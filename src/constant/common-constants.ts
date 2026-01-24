const constants = {
  CLIENT_IDENTIFIER: "fs-official-2",
  PROGRESS_LOG_INTERVAL_MS: 5 * 1000,
  UX_PROGRESS_LOG_INTERVAL_MS: 10 * 1000,
  SYNC_HASHFILE_SIZE_THRESHOLD_BYTES: 10_000_000,

  // New constants for v2
  RECYCLE_DIR_NAME: ".fs-recycle",
  DEFAULT_IO_TIMEOUT_SECONDS: 30,
  DEFAULT_HASH_ALGORITHM: "sha256",
  DB_BATCH_COMMIT_SIZE: 100, // Commit database transaction after processing this many files

  crypto: {
    HASH_ALGO_SHA256: "sha256",
    SALT_BYTE_LEN: 128,
    ITERATION_COUNT: 10302,
    PASSWORD_DIGEST_KEYLEN: 512,
    DIGEST_ALGO: "sha256",
  },
};

export default constants;
