import Database from "better-sqlite3";
import { SCHEMA, SummaryRow, OperationRow, FileRow, SummaryData, FileData } from "../model/database-schema.js";

const openDatabaseServices: Set<DatabaseService> = new Set();

/**
 * Database service for SQLite operations
 */
export class DatabaseService {
  /**
   * Closes all open database connections across all DatabaseService instances
   */
  public static closeAllConnections(): void {
    for (const service of openDatabaseServices) {
      service.close();
    }
    openDatabaseServices.clear();
  }

  private db: Database.Database | null = null;
  private digestFilePath: string | null = null;

  /**
   * Opens or creates a database connection
   */
  open(digestFilePath: string): void {
    if (this.db) {
      throw new Error("Database is already open. Close it before opening a new one.");
    }

    this.digestFilePath = digestFilePath;
    this.db = new Database(digestFilePath);

    // Enable WAL mode for better concurrency
    this.db.pragma("journal_mode = WAL");

    // Initialize schema
    this.initializeSchema();

    openDatabaseServices.add(this);
  }

  /**
   * Closes the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.digestFilePath = null;
    }

    openDatabaseServices.delete(this);
  }

  /**
   * Checks if database is open
   */
  isOpen(): boolean {
    return this.db !== null;
  }

  /**
   * Gets the current database file path
   */
  getDigestFilePath(): string | null {
    return this.digestFilePath;
  }

  /**
   * Initializes database schema
   */
  private initializeSchema(): void {
    this.ensureOpen();

    // Create tables
    this.db!.exec(SCHEMA.summary);
    this.db!.exec(SCHEMA.operations);
    this.db!.exec(SCHEMA.files);

    // Create indexes
    for (const indexSQL of SCHEMA.indexes) {
      this.db!.exec(indexSQL);
    }
  }

  // ==================== Summary Operations ====================

  /**
   * Gets the summary row (should only be one)
   */
  getSummary(): SummaryRow | null {
    this.ensureOpen();
    const stmt = this.db!.prepare("SELECT * FROM summary WHERE id = 1");
    return (stmt.get() as SummaryRow) || null;
  }

  /**
   * Upserts the summary data (always uses id = 1)
   */
  upsertSummary(data: SummaryData): void {
    this.ensureOpen();
    const stmt = this.db!.prepare(`
      INSERT INTO summary (id, total_files, total_size, created_at, modified_at)
      VALUES (1, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        total_files = excluded.total_files,
        total_size = excluded.total_size,
        modified_at = excluded.modified_at
    `);

    stmt.run(data.total_files, data.total_size, data.created_at, data.modified_at);
  }

  // ==================== Operations Log ====================

  /**
   * Starts a new operation and returns its ID
   */
  startOperation(operation: string): number {
    this.ensureOpen();
    const stmt = this.db!.prepare(`
      INSERT INTO operations (operation, started_at, completed_at, success, error_count)
      VALUES (?, ?, NULL, NULL, 0)
    `);

    const result = stmt.run(operation, Date.now());
    return result.lastInsertRowid as number;
  }

  /**
   * Completes an operation
   */
  completeOperation(id: number, success: boolean, errorCount: number): void {
    this.ensureOpen();
    const stmt = this.db!.prepare(`
      UPDATE operations
      SET completed_at = ?, success = ?, error_count = ?
      WHERE id = ?
    `);

    stmt.run(Date.now(), success ? 1 : 0, errorCount, id);
  }

  /**
   * Gets all operations
   */
  getAllOperations(): OperationRow[] {
    this.ensureOpen();
    const stmt = this.db!.prepare("SELECT * FROM operations ORDER BY started_at DESC");
    return stmt.all() as OperationRow[];
  }

  /**
   * Gets the last operation
   */
  getLastOperation(): OperationRow | null {
    this.ensureOpen();
    const stmt = this.db!.prepare("SELECT * FROM operations ORDER BY started_at DESC LIMIT 1");
    return (stmt.get() as OperationRow) || null;
  }

  // ==================== File Operations ====================

  /**
   * Gets a file by relative path
   */
  getFile(relativePath: string): FileRow | null {
    this.ensureOpen();
    const stmt = this.db!.prepare("SELECT * FROM files WHERE relative_path = ?");
    return (stmt.get(relativePath) as FileRow) || null;
  }

  /**
   * Upserts a file record
   */
  upsertFile(data: FileData): void {
    this.ensureOpen();
    const stmt = this.db!.prepare(`
      INSERT INTO files (relative_path, size, created_at, modified_at, hash_sha256)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(relative_path) DO UPDATE SET
        size = excluded.size,
        modified_at = excluded.modified_at,
        hash_sha256 = excluded.hash_sha256
    `);

    stmt.run(data.relative_path, data.size, data.created_at, data.modified_at, data.hash_sha256);
  }

  /**
   * Deletes a file by relative path
   */
  deleteFile(relativePath: string): void {
    this.ensureOpen();
    const stmt = this.db!.prepare("DELETE FROM files WHERE relative_path = ?");
    stmt.run(relativePath);
  }

  /**
   * Gets all files
   */
  getAllFiles(): FileRow[] {
    this.ensureOpen();
    const stmt = this.db!.prepare("SELECT * FROM files ORDER BY relative_path");
    return stmt.all() as FileRow[];
  }

  /**
   * Gets files in a specific subdirectory
   */
  getFilesInSubdirectory(subdirectory: string): FileRow[] {
    this.ensureOpen();
    // Normalize subdirectory path (remove leading/trailing slashes)
    const normalizedSubdir = subdirectory.replace(/^\/+|\/+$/g, "");
    const pattern = normalizedSubdir + "/%";

    const stmt = this.db!.prepare("SELECT * FROM files WHERE relative_path LIKE ? ORDER BY relative_path");
    return stmt.all(pattern) as FileRow[];
  }

  /**
   * Gets the count of all files
   */
  getFileCount(): number {
    this.ensureOpen();
    const stmt = this.db!.prepare("SELECT COUNT(*) as count FROM files");
    const result = stmt.get() as { count: number };
    return result.count;
  }

  /**
   * Gets the total size of all files
   */
  getTotalSize(): number {
    this.ensureOpen();
    const stmt = this.db!.prepare("SELECT SUM(size) as total FROM files");
    const result = stmt.get() as { total: number | null };
    return result.total || 0;
  }

  // ==================== Transaction Operations ====================

  /**
   * Begins a transaction
   */
  beginTransaction(): void {
    this.ensureOpen();
    this.db!.exec("BEGIN TRANSACTION");
  }

  /**
   * Commits a transaction
   */
  commitTransaction(): void {
    this.ensureOpen();
    this.db!.exec("COMMIT");
  }

  /**
   * Rolls back a transaction
   */
  rollbackTransaction(): void {
    this.ensureOpen();
    this.db!.exec("ROLLBACK");
  }

  /**
   * Executes a function within a transaction
   */
  transaction<T>(fn: () => T): T {
    this.beginTransaction();
    try {
      const result = fn();
      this.commitTransaction();
      return result;
    } catch (error) {
      this.rollbackTransaction();
      throw error;
    }
  }

  // ==================== Helper Methods ====================

  /**
   * Ensures the database is open
   */
  private ensureOpen(): void {
    if (!this.db) {
      throw new Error("Database is not open. Call open() first.");
    }
  }
}

// Singleton instance
let instance: DatabaseService | null = null;

/**
 * Gets the singleton database service instance
 */
export function getDatabaseService(): DatabaseService {
  if (!instance) {
    instance = new DatabaseService();
  }
  return instance;
}
