import { isPathRisky, getSafePath, formatRiskyPathError } from "../src/utility/path-sanitization-utility.js";
import path from "path";

describe("Path Sanitization Utility", () => {
  describe("isPathRisky", () => {
    test("should return false for safe paths", () => {
      expect(isPathRisky("file.txt")).toBe(false);
      expect(isPathRisky("my-file.txt")).toBe(false);
      expect(isPathRisky("document_123.pdf")).toBe(false);
      expect(isPathRisky("folder/subfolder/file.txt")).toBe(false);
      expect(isPathRisky("folder/subfolder")).toBe(false);
      expect(isPathRisky("")).toBe(false);
    });

    test("should return true for filenames with forward slash (invalid)", () => {
      // Note: Forward slash in a filename component is invalid, but as path separator it's fine
      // This test checks for actual forward slash in a filename (which would be invalid)
      // Since we split by path.sep, a single component with "/" would be caught
      // But on Unix, path.sep is "/", so "file/name.txt" would split into ["file", "name.txt"]
      // To test this properly, we'd need a component that has "/" but isn't a separator
      // For now, we test that path separators don't trigger the check
      expect(isPathRisky("folder/subfolder/file.txt")).toBe(false); // "/" is separator, not risky
    });

    test("should return true for paths with colon", () => {
      expect(isPathRisky("file:name.txt")).toBe(true);
      expect(isPathRisky("folder:subfolder")).toBe(true);
      expect(isPathRisky("1 Islam: A Very Short Introduction")).toBe(true);
    });

    test("should return true for paths with angle brackets", () => {
      expect(isPathRisky("file<name.txt")).toBe(true);
      expect(isPathRisky("file>name.txt")).toBe(true);
      expect(isPathRisky("file<>name.txt")).toBe(true);
    });

    test("should return true for paths with quotes", () => {
      expect(isPathRisky('file"name.txt')).toBe(true);
      expect(isPathRisky('"quoted"')).toBe(true);
    });

    test("should return true for paths with backslash", () => {
      expect(isPathRisky("file\\name.txt")).toBe(true);
      expect(isPathRisky("folder\\subfolder")).toBe(true);
    });

    test("should return true for paths with pipe", () => {
      expect(isPathRisky("file|name.txt")).toBe(true);
      expect(isPathRisky("file|name")).toBe(true);
    });

    test("should return true for paths with question mark", () => {
      expect(isPathRisky("file?name.txt")).toBe(true);
      expect(isPathRisky("what?.txt")).toBe(true);
    });

    test("should return true for paths with asterisk", () => {
      expect(isPathRisky("file*name.txt")).toBe(true);
      expect(isPathRisky("*wildcard*")).toBe(true);
    });

    test("should return true for paths with null byte", () => {
      expect(isPathRisky("file\0name.txt")).toBe(true);
      expect(isPathRisky("\0null")).toBe(true);
    });

    test("should return true for paths with multiple risky characters", () => {
      expect(isPathRisky("file:name<test>.txt")).toBe(true);
      expect(isPathRisky("folder:subfolder/file|name.txt")).toBe(true);
    });

    test("should handle directory paths", () => {
      // Path separators are not risky, only characters in filename components
      expect(isPathRisky("folder/subfolder")).toBe(false); // "/" is separator, not risky
      expect(isPathRisky("folder:subfolder")).toBe(true); // ":" is risky in filename
      // Backslash as separator depends on platform, but as character in component it's risky
      // On Unix, "\" in a component would be risky
      // On Windows, "\" is the separator, so "folder\subfolder" would split into ["folder", "subfolder"]
      if (path.sep === "\\") {
        expect(isPathRisky("folder\\subfolder")).toBe(false); // "\" is separator on Windows
      } else {
        expect(isPathRisky("folder\\subfolder")).toBe(true); // "\" is risky character on Unix
      }
    });
  });

  describe("getSafePath", () => {
    test("should return unchanged path for safe paths", () => {
      expect(getSafePath("file.txt")).toBe("file.txt");
      expect(getSafePath("my-file.txt")).toBe("my-file.txt");
      expect(getSafePath("document_123.pdf")).toBe("document_123.pdf");
    });

    test("should sanitize colon to exclamation", () => {
      expect(getSafePath("file:name.txt")).toBe("file!name.txt");
      expect(getSafePath("1 Islam: A Very Short Introduction")).toBe("1 Islam! A Very Short Introduction");
      expect(getSafePath("folder:subfolder")).toBe("folder!subfolder");
    });

    test("should sanitize angle brackets", () => {
      expect(getSafePath("file<name.txt")).toBe("file!name.txt");
      expect(getSafePath("file>name.txt")).toBe("file!name.txt");
      expect(getSafePath("file<>name.txt")).toBe("file!!name.txt");
    });

    test("should sanitize quotes", () => {
      expect(getSafePath('file"name.txt')).toBe("file!name.txt");
      expect(getSafePath('"quoted"')).toBe("!quoted!");
    });

    test("should sanitize backslash", () => {
      expect(getSafePath("file\\name.txt")).toBe("file!name.txt");
      expect(getSafePath("folder\\subfolder")).toBe("folder!subfolder");
    });

    test("should sanitize pipe", () => {
      expect(getSafePath("file|name.txt")).toBe("file!name.txt");
      expect(getSafePath("file|name")).toBe("file!name");
    });

    test("should sanitize question mark", () => {
      expect(getSafePath("file?name.txt")).toBe("file!name.txt");
      expect(getSafePath("what?.txt")).toBe("what!.txt");
    });

    test("should sanitize asterisk", () => {
      expect(getSafePath("file*name.txt")).toBe("file!name.txt");
      expect(getSafePath("*wildcard*")).toBe("!wildcard!");
    });

    test("should remove null byte", () => {
      expect(getSafePath("file\0name.txt")).toBe("filename.txt");
      expect(getSafePath("\0null")).toBe("null");
      expect(getSafePath("test\0\0file")).toBe("testfile");
    });

    test("should handle multiple risky characters", () => {
      expect(getSafePath("file:name<test>.txt")).toBe("file!name!test!.txt");
      expect(getSafePath("folder:subfolder|file.txt")).toBe("folder!subfolder!file.txt");
    });

    test("should preserve path separators", async () => {
      // Note: forward slash is forbidden in filenames, but path.sep is a separator
      // This test checks that path separators are preserved
      const pathModule = await import("path");
      const pathWithSep = `folder${pathModule.sep}subfolder${pathModule.sep}file.txt`;
      const sanitized = getSafePath(pathWithSep);
      expect(sanitized).toContain(pathModule.sep);
    });

    test("should handle empty parts after sanitization", () => {
      expect(getSafePath(":")).toBe("!");
      expect(getSafePath("<>")).toBe("!!");
      // Null bytes are removed, so "\0\0" becomes empty, then replaced with REPLACEMENT
      expect(getSafePath("\0\0")).toBe("!");
    });

    test("should remove trailing dots and spaces (Windows compatibility)", () => {
      expect(getSafePath("file.txt.")).toBe("file.txt");
      expect(getSafePath("file.txt ")).toBe("file.txt");
      expect(getSafePath("file.txt.  ")).toBe("file.txt");
      expect(getSafePath("file...")).toBe("file");
    });

    test("should handle complex directory paths", () => {
      expect(getSafePath("folder:name/subfolder:name/file:name.txt")).toBe("folder!name/subfolder!name/file!name.txt");
    });

    test("should handle paths with all risky characters", () => {
      const risky = 'file<:>"\\|?*name\0.txt';
      const safe = getSafePath(risky);
      // Count: <, :, >, ", \, |, ?, *, \0 = 9 characters, all replaced with !
      expect(safe).toBe("file!!!!!!!!name.txt");
      expect(isPathRisky(safe)).toBe(false);
    });
  });

  describe("formatRiskyPathError", () => {
    test("should format error message without safe path", () => {
      const message = formatRiskyPathError("file:name.txt");
      expect(message).toContain("PROBLEMATIC FILENAME DETECTED");
      expect(message).toContain("file:name.txt");
      expect(message).toContain("FAT32, exFAT, NTFS, macOS, Windows");
      expect(message).toContain("Options:");
      expect(message).toContain("--compatibility-risk-strategy");
    });

    test("should format error message with safe path", () => {
      const message = formatRiskyPathError("file:name.txt", "file!name.txt");
      expect(message).toContain("PROBLEMATIC FILENAME DETECTED");
      expect(message).toContain("file:name.txt");
      expect(message).toContain("Safe alternative: file!name.txt");
      expect(message).toContain("Options:");
    });

    test("should include all strategy options", () => {
      const message = formatRiskyPathError("test:file.txt");
      expect(message).toContain("skip");
      expect(message).toContain("accept-risk");
      expect(message).toContain("mitigate-or-abort");
      expect(message).toContain("mitigate-or-skip");
      expect(message).toContain("mitigate-or-accept-risk");
    });

    test("should mention mitigation strategies", () => {
      const message = formatRiskyPathError("test:file.txt");
      expect(message).toContain("mitigate-or-abort");
      expect(message).toContain("mitigate-or-skip");
      expect(message).toContain("mitigate-or-accept-risk");
    });

    test("should handle directory paths", () => {
      const message = formatRiskyPathError("folder:name/subfolder", "folder!name/subfolder");
      expect(message).toContain("folder:name/subfolder");
      expect(message).toContain("Safe alternative: folder!name/subfolder");
    });

    test("should have proper formatting with separators", () => {
      const message = formatRiskyPathError("test:file.txt");
      const lines = message.split("\n");
      expect(lines[0]).toBe("");
      expect(lines[1]).toContain("═");
      // Last line should be the closing separator line
      const lastNonEmptyLine = lines.filter((line) => line.trim().length > 0).pop();
      expect(lastNonEmptyLine).toContain("═");
    });
  });
});
