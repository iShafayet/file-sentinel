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

    // Migrate existing databases to add new columns if they don't exist
    this.migrateSchema();
  }

  /**
   * Migrates schema by adding new columns if they don't exist
   */
  private migrateSchema(): void {
    this.ensureOpen();

    try {
      // Check if last_attempted_at column exists
      const tableInfo = this.db!.prepare("PRAGMA table_info(files)").all() as Array<{ name: string }>;
      const columnNames = tableInfo.map((col) => col.name);

      if (!columnNames.includes("last_attempted_at")) {
        this.db!.exec("ALTER TABLE files ADD COLUMN last_attempted_at INTEGER DEFAULT 0");
      }

      if (!columnNames.includes("last_attempt_result")) {
        this.db!.exec("ALTER TABLE files ADD COLUMN last_attempt_result TEXT");
      }
    } catch (error) {
      // If migration fails, log but don't throw (allows database to still work)
      console.warn("Schema migration warning:", (error as Error).message);
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
    const lastAttemptedAt = data.last_attempted_at ?? 0;
    const lastAttemptResult = data.last_attempt_result ?? null;
    const stmt = this.db!.prepare(`
      INSERT INTO files (relative_path, size, created_at, modified_at, hash_sha256, last_attempted_at, last_attempt_result)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(relative_path) DO UPDATE SET
        size = excluded.size,
        modified_at = excluded.modified_at,
        hash_sha256 = excluded.hash_sha256,
        last_attempted_at = excluded.last_attempted_at,
        last_attempt_result = excluded.last_attempt_result
    `);

    stmt.run(
      data.relative_path,
      data.size,
      data.created_at,
      data.modified_at,
      data.hash_sha256,
      lastAttemptedAt,
      lastAttemptResult
    );
  }

  /**
   * Updates the attempt tracking fields for a file
   * @param relativePath - The relative path of the file
   * @param result - The result of the operation (e.g., "success", "failed", "error")
   */
  updateFileAttempt(relativePath: string, result: string | null): void {
    this.ensureOpen();
    const stmt = this.db!.prepare(`
      UPDATE files
      SET last_attempted_at = ?, last_attempt_result = ?
      WHERE relative_path = ?
    `);

    stmt.run(Date.now(), result, relativePath);
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
    const stmt = this.db!.prepare(`
      SELECT * FROM files 
      ORDER BY 
        CASE WHEN last_attempted_at = 0 THEN 0 ELSE 1 END,
        last_attempted_at DESC, 
        relative_path
    `);
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

    const stmt = this.db!.prepare(`
      SELECT * FROM files 
      WHERE relative_path LIKE ? 
      ORDER BY 
        CASE WHEN last_attempted_at = 0 THEN 0 ELSE 1 END,
        last_attempted_at DESC, 
        relative_path
    `);
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
