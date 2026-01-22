import { isFileWritable } from "../src/utility/file-utils.js";
import fs from "fs";
import path from "path";
import os from "os";
import Database from "better-sqlite3";

// Skip this test suite if running on Windows (chmod permissions work differently)
const describeIfUnix = process.platform === "win32" ? describe.skip : describe;

describeIfUnix("Readonly Digest Handling", () => {
  let testDir: string;
  let digestPath: string;

  beforeEach(() => {
    // Create a temporary test directory
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "fs-readonly-test-"));
    digestPath = path.join(testDir, "test-digest.db");
  });

  afterEach(() => {
    // Cleanup: restore permissions and remove test directory
    try {
      if (fs.existsSync(digestPath)) {
        fs.chmodSync(digestPath, 0o644);
        fs.unlinkSync(digestPath);
      }
      fs.rmdirSync(testDir);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("isFileWritable", () => {
    test("should return true for writable file", () => {
      // Create a writable file
      fs.writeFileSync(digestPath, "test");
      fs.chmodSync(digestPath, 0o644);

      expect(isFileWritable(digestPath)).toBe(true);
    });

    test("should return false for readonly file", () => {
      // Create a readonly file
      fs.writeFileSync(digestPath, "test");
      fs.chmodSync(digestPath, 0o444);

      expect(isFileWritable(digestPath)).toBe(false);
    });

    test("should return true for non-existent file in writable directory", () => {
      const nonExistentPath = path.join(testDir, "non-existent.db");
      
      expect(isFileWritable(nonExistentPath)).toBe(true);
    });

    test("should return false for non-existent file in readonly directory", () => {
      const readonlyDir = path.join(testDir, "readonly-dir");
      fs.mkdirSync(readonlyDir);
      fs.chmodSync(readonlyDir, 0o555);

      const nonExistentPath = path.join(readonlyDir, "test.db");

      expect(isFileWritable(nonExistentPath)).toBe(false);

      // Cleanup
      fs.chmodSync(readonlyDir, 0o755);
      fs.rmdirSync(readonlyDir);
    });

    test("should return false for non-existent file in non-existent directory", () => {
      const nonExistentPath = path.join(testDir, "non-existent-dir", "test.db");

      expect(isFileWritable(nonExistentPath)).toBe(false);
    });
  });

  describe("SQLite readonly database behavior", () => {
    test("database opens successfully even when readonly", () => {
      // Create database
      const db = new Database(digestPath);
      db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY)");
      db.close();

      // Make it readonly
      fs.chmodSync(digestPath, 0o444);

      // Opening should succeed
      expect(() => {
        const db2 = new Database(digestPath);
        db2.close();
      }).not.toThrow();
    });

    test("write to readonly database throws SQLITE_READONLY error", () => {
      // Create database
      const db = new Database(digestPath);
      db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY)");
      db.close();

      // Make it readonly
      fs.chmodSync(digestPath, 0o444);

      // Open and try to write
      const db2 = new Database(digestPath);

      expect(() => {
        db2.exec("INSERT INTO test (id) VALUES (1)");
      }).toThrow();

      try {
        db2.exec("INSERT INTO test (id) VALUES (1)");
      } catch (error: any) {
        expect(error.code).toBe("SQLITE_READONLY");
        expect(error.message).toContain("readonly database");
      }

      db2.close();
    });

    test("write operations in transaction fail on readonly database", () => {
      // Create database
      const db = new Database(digestPath);
      db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY)");
      db.close();

      // Make it readonly
      fs.chmodSync(digestPath, 0o444);

      // Open database
      const db2 = new Database(digestPath);

      // BEGIN TRANSACTION may succeed, but write will fail
      db2.exec("BEGIN TRANSACTION");

      // The actual write will fail with SQLITE_READONLY
      expect(() => {
        db2.exec("INSERT INTO test (id) VALUES (1)");
      }).toThrow();

      try {
        db2.exec("INSERT INTO test (id) VALUES (1)");
      } catch (error: any) {
        expect(error.code).toBe("SQLITE_READONLY");
        expect(error.message).toContain("readonly database");
      }

      db2.close();
    });

    test("read operations work on readonly database", () => {
      // Create database with some data
      const db = new Database(digestPath);
      db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)");
      db.exec("INSERT INTO test (id, value) VALUES (1, 'test')");
      db.close();

      // Make it readonly
      fs.chmodSync(digestPath, 0o444);

      // Open and read
      const db2 = new Database(digestPath);
      const stmt = db2.prepare("SELECT * FROM test WHERE id = ?");
      const row = stmt.get(1);

      expect(row).toEqual({ id: 1, value: "test" });

      db2.close();
    });
  });

  describe("Pre-check prevention", () => {
    test("isFileWritable should detect readonly file before opening database", () => {
      // Create database
      const db = new Database(digestPath);
      db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY)");
      db.close();

      // Make it readonly
      fs.chmodSync(digestPath, 0o444);

      // Pre-check should fail
      expect(isFileWritable(digestPath)).toBe(false);
    });

    test("isFileWritable should succeed for writable file before opening database", () => {
      // Create database
      const db = new Database(digestPath);
      db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY)");
      db.close();

      // Keep it writable
      fs.chmodSync(digestPath, 0o644);

      // Pre-check should succeed
      expect(isFileWritable(digestPath)).toBe(true);
    });
  });
});
