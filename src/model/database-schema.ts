/**
 * SQLite schema definitions for the digest database
 */

export const SCHEMA = {
  summary: `
    CREATE TABLE IF NOT EXISTS summary (
      id INTEGER PRIMARY KEY,
      total_files INTEGER NOT NULL,
      total_size INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      modified_at INTEGER NOT NULL
    )
  `,

  operations: `
    CREATE TABLE IF NOT EXISTS operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      completed_at INTEGER,
      success INTEGER,
      error_count INTEGER DEFAULT 0
    )
  `,

  files: `
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      relative_path TEXT NOT NULL UNIQUE,
      size INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      modified_at INTEGER NOT NULL,
      hash_sha256 TEXT NOT NULL,
      last_attempted_at INTEGER DEFAULT 0,
      last_attempt_result TEXT
    )
  `,

  indexes: [
    `CREATE INDEX IF NOT EXISTS idx_files_relative_path ON files(relative_path)`,
  ],
};

// Type definitions for database rows
export type SummaryRow = {
  id: number;
  total_files: number;
  total_size: number;
  created_at: number;
  modified_at: number;
};

export type OperationRow = {
  id: number;
  operation: string;
  started_at: number;
  completed_at: number | null;
  success: number | null; // SQLite uses INTEGER for boolean (0/1)
  error_count: number;
};

export type FileRow = {
  id: number;
  relative_path: string;
  size: number;
  created_at: number;
  modified_at: number;
  hash_sha256: string;
  last_attempted_at: number;
  last_attempt_result: string | null;
};

// Input data types (for inserts/updates)
export type SummaryData = {
  total_files: number;
  total_size: number;
  created_at: number;
  modified_at: number;
};

export type FileData = {
  relative_path: string;
  size: number;
  created_at: number;
  modified_at: number;
  hash_sha256: string;
  last_attempted_at?: number;
  last_attempt_result?: string | null;
};

