# Command Reference

This document provides complete details for all File Sentinel commands and options.

## General Syntax

```bash
file-sentinel <command> [options]
```

To see available commands:

```bash
file-sentinel --help
```

To see help for a specific command:

```bash
file-sentinel <command> --help
```

## Global Options

These options are available for all commands:

### --verbose

Display detailed information about each file being processed.

```bash
file-sentinel digest -i ~/docs::~/docs.db --verbose
```

**Output includes**:

- Each file being processed
- Progress percentages
- Detailed operation statistics

### --panic-on-error

Exit immediately when an error occurs instead of continuing.

```bash
file-sentinel verify -i ~/docs::~/docs.db --panic-on-error
```

**Use when**:

- Errors must stop the process
- Running in automated scripts
- Validation requirements are strict

### --dry-run

Simulate the operation without making any changes.

```bash
file-sentinel replicate \
  -i ~/source::~/source.db \
  -o ~/dest::~/dest.db \
  --dry-run
```

**What happens**:

- All checks and validations run
- No files are modified or copied
- No database changes are made
- Shows what would be done

### -t, --io-timeout <seconds>

Set the I/O timeout in seconds (default: 30).

```bash
file-sentinel digest -i ~/docs::~/docs.db -t 60
```

**Use when**:

- Working with slow storage (network drives, USB)
- Large files that take time to read
- Unstable connections

### --no-tty

Disable TTY mode to remove interactive features and ANSI colors.

```bash
file-sentinel digest -i ~/docs::~/docs.db --no-tty
```

**What changes**:

- No progress bars or spinners
- No ANSI color codes in output
- No interactive keypress prompts
- Logs output immediately (not buffered)

### --recency-threshold <seconds>

Skip files that were processed within the specified time threshold (in seconds). Default: 0 (no threshold, process all files).

```bash
file-sentinel verify -i ~/docs::~/docs.db --recency-threshold 3600
```

**How it works**:

- Files are tracked with `last_attempted_at` timestamp in the digest database
- When a file is processed (digest, verify, replicate, or heal), its timestamp is updated
- If `--recency-threshold` is set, files processed within that time window are skipped
- Never-attempted files (timestamp = 0) are always processed
- Skipped files are logged with a message showing how long ago they were processed

**Use cases**:

- **Resume interrupted operations** - Skip files already processed in a recent run
- **Incremental processing** - Only process files that haven't been touched recently
- **Avoid redundant work** - Prevent re-processing files that were just handled
- **Progress preservation** - Continue from where you left off after interruptions

**Examples**:

```bash
# Skip files processed in the last hour (3600 seconds)
file-sentinel verify -i ~/docs::~/docs.db --recency-threshold 3600

# Skip files processed in the last 30 minutes (1800 seconds)
file-sentinel digest -i ~/docs::~/docs.db --recency-threshold 1800

# Process all files (default behavior)
file-sentinel verify -i ~/docs::~/docs.db --recency-threshold 0
```

**Behavior**:

- Files are ordered by `last_attempted_at` ascending (never-attempted files first, then oldest attempted, then most recent)
- When a file is skipped, you'll see: `Skipping file.txt - processed 2 minutes 30 seconds ago (within 300 second threshold)`
- The database still returns all files; filtering happens in application code
- This ensures progress is preserved even when operations are interrupted, prioritizing files that need attention
- Clean, parseable text output

**Use when**:

- Output is redirected to a file (`> output.log`)
- Running in CI/CD pipelines
- Running in automated scripts
- Parsing output with other tools
- Terminal doesn't support ANSI codes

**Example with output redirection**:

```bash
file-sentinel verify -i ~/docs::~/docs.db --no-tty > verify.log 2>&1
```

**Note**: TTY mode is automatically detected when output is redirected, but `--no-tty` can be used to explicitly force non-TTY behavior.

## digest Command

Create or update a digest for a directory.

### Syntax

```bash
file-sentinel digest -i <directory>::<digest-file> [options]
```

### Required Options

#### -i, --input <directory>::<digest-file>

Specify the directory to digest and where to store the digest file.

```bash
file-sentinel digest -i ~/Documents::~/Documents/digest.db
```

**Format**: `directory-path::digest-file-path`

**Examples**:

```bash
# Linux/macOS
-i /home/user/photos::/home/user/photos.db

# Windows
-i C:\Users\John\Documents::C:\Users\John\documents.db

# Relative paths
-i ./data::./data-digest.db
```

### Optional Options

#### -a, --hash-algorithm <algorithm>

Specify the hashing algorithm (default: sha256).

```bash
file-sentinel digest -i ~/docs::~/docs.db -a sha256
```

**Currently supported**: sha256 only

#### --compatibility-risk-strategy <strategy>

Specify how to handle filenames with problematic characters that may cause issues on some filesystems (FAT32, exFAT, NTFS, macOS, Windows).

```bash
file-sentinel digest -i ~/docs::~/docs.db --compatibility-risk-strategy=skip
```

**Default**: `abort`

**Problematic characters**: `/`, `<`, `>`, `:`, `"`, `\`, `|`, `?`, `*`, `\0` (null byte)

**Available strategies**:

1. **`abort`** (default)
   - Stops immediately when a problematic filename is detected
   - Displays a detailed error message with options
   - Use when you want to manually fix filenames before proceeding

2. **`skip`**
   - Skips files with problematic names
   - Logs a warning for each skipped file
   - Continues processing other files
   - Use when you want to ignore problematic files

3. **`accept-risk`**
   - Processes files with problematic names as-is
   - May fail later during replicate or heal operations
   - Use when you know the target filesystem supports these characters

4. **`mitigate-or-abort`**
   - Attempts to automatically rename files to safe alternatives
   - Replaces problematic characters with `!`
   - Aborts if renaming fails
   - Use when you want automatic fixes but need to know if they fail

5. **`mitigate-or-skip`**
   - Attempts to automatically rename files to safe alternatives
   - Skips files if renaming fails
   - Use when you want automatic fixes but can tolerate some failures

6. **`mitigate-or-accept-risk`**
   - Attempts to automatically rename files to safe alternatives
   - Accepts original filename if renaming fails
   - Use when you want automatic fixes but will accept risk if they fail

**Examples**:

```bash
# Skip problematic files
file-sentinel digest -i ~/docs::~/docs.db --compatibility-risk-strategy=skip

# Auto-rename problematic files (abort if rename fails)
file-sentinel digest -i ~/docs::~/docs.db --compatibility-risk-strategy=mitigate-or-abort

# Accept risky filenames (may fail on replicate/heal)
file-sentinel digest -i ~/docs::~/docs.db --compatibility-risk-strategy=accept-risk
```

**When to use**:

- **Cross-platform compatibility**: When you plan to replicate to different filesystems (e.g., Windows FAT32, macOS, Linux)
- **Mixed filesystems**: When your source and destination use different filesystems
- **Legacy data**: When dealing with files that may have been created on different systems
- **Automated workflows**: When you want automatic handling without manual intervention

**Note**: This option only affects the `digest` command. Files with problematic names that were accepted during digest may still fail during `replicate` or `heal` operations if the target filesystem doesn't support them.

### What It Does

1. **Scans the directory** - Finds all regular files recursively
2. **Calculates hashes** - For new files or files that changed
3. **Updates database** - Adds new entries, updates changed files
4. **Removes old entries** - Deletes records for files that no longer exist
5. **Updates summary** - Records total files, size, and timestamp

### Output

```
Starting Digest Operation
Input Directory: /home/user/Documents
Digest File: /home/user/Documents/digest.db
Hash Algorithm: sha256
Dry Run: false

Discovering files...
Discovered 523 files

Processing files...
DIGEST Operation COMPLETED
Total Files Processed: 523
Total Bytes Processed: 4.2 GB
Execution Time: 00:05:32
Errors: 0

Files Added: 45
Files Updated: 8
Files Unchanged: 470
Files Deleted: 0
```

### Examples

**Create a new digest**:

```bash
file-sentinel digest -i ~/Documents::~/digest.db
```

**Update an existing digest**:

```bash
# Same command - automatically updates if digest exists
file-sentinel digest -i ~/Documents::~/digest.db
```

**Verbose output**:

```bash
file-sentinel digest -i ~/Documents::~/digest.db --verbose
```

**Dry run to preview changes**:

```bash
file-sentinel digest -i ~/Documents::~/digest.db --dry-run
```

## verify Command

Verify files against a digest to detect corruption or changes.

### Syntax

```bash
file-sentinel verify -i <directory>::<digest-file> [options]
```

### Required Options

#### -i, --input <directory>::<digest-file>

Specify the directory and digest file to verify.

```bash
file-sentinel verify -i ~/Documents::~/Documents/digest.db
```

### Optional Options

#### -s, --subdirectory <path>

Verify only files in a specific subdirectory.

```bash
file-sentinel verify \
  -i ~/Documents::~/digest.db \
  -s photos/2024
```

**Path is relative** to the directory root.

#### -a, --hash-algorithm <algorithm>

Specify the hashing algorithm (default: sha256).

```bash
file-sentinel verify -i ~/docs::~/docs.db -a sha256
```

### What It Does

1. **Reads the digest** - Loads file information from database
2. **Filters by subdirectory** - If specified, limits to that folder
3. **Checks each file** - Verifies existence, size, and hash
4. **Reports results** - Shows passed, failed, missing, and extra files

### Output

```
Starting Verify Operation
Input Directory: /home/user/Documents
Digest File: /home/user/Documents/digest.db
Subdirectory: (entire directory)
Hash Algorithm: sha256

Found 523 files in digest
Discovered 523 files on disk
Verifying files...

VERIFY Operation COMPLETED
Total Files Processed: 523
Execution Time: 00:03:21
Errors: 0

Files Verified: 520
Files Failed: 2
Files Missing: 1
Files Extra: 0
```

### Understanding Results

- **Files Verified** - Files that match their stored hash (good)
- **Files Failed** - Files with hash mismatches (corrupted or modified)
- **Files Missing** - In digest but not found on disk
- **Files Extra** - On disk but not in digest (new files)

### Examples

**Verify entire directory**:

```bash
file-sentinel verify -i ~/Documents::~/digest.db
```

**Verify only photos from 2024**:

```bash
file-sentinel verify \
  -i ~/Documents::~/digest.db \
  -s photos/2024
```

**Stop on first error**:

```bash
file-sentinel verify \
  -i ~/Documents::~/digest.db \
  --panic-on-error
```

**Detailed output**:

```bash
file-sentinel verify \
  -i ~/Documents::~/digest.db \
  --verbose
```

## replicate Command

Copy files from source to destination with integrity verification and mirror fallback.

### Syntax

```bash
file-sentinel replicate \
  -i <source>::<source-digest> \
  -o <destination>::<dest-digest> \
  [options]
```

### Required Options

#### -i, --input <source>::<source-digest>

Specify the source directory and its digest.

```bash
-i ~/Documents::~/Documents/digest.db
```

#### -o, --output <destination>::<dest-digest>

Specify the destination directory and digest file.

```bash
-o /backup/Documents::/backup/Documents/digest.db
```

### Optional Options

#### -s, --subdirectory <path>

Replicate only a specific subdirectory.

```bash
file-sentinel replicate \
  -i ~/Documents::~/docs.db \
  -o /backup/Documents::/backup/docs.db \
  -s reports/2024
```

#### --mirror <directory>::<digest-file>

Specify a mirror to use as fallback if source is corrupted. Can be repeated.

```bash
file-sentinel replicate \
  -i ~/Documents::~/docs.db \
  -o /backup/Documents::/backup/docs.db \
  --mirror /mirror1/Documents::/mirror1/docs.db \
  --mirror /mirror2/Documents::/mirror2/docs.db
```

**Order matters** - Mirrors are tried sequentially in the order specified.

#### --perma-delete

Permanently delete files instead of moving to recycle bin.

```bash
file-sentinel replicate \
  -i ~/source::~/source.db \
  -o ~/dest::~/dest.db \
  --perma-delete
```

**Default behavior**: Files are moved to `.fs-recycle` directory.

#### --validate-post-copy

Enable validation of copied files after replication by verifying their hash (default: enabled).

```bash
file-sentinel replicate \
  -i ~/source::~/source.db \
  -o ~/dest::~/dest.db \
  --validate-post-copy
```

To disable validation (faster but less safe):

```bash
file-sentinel replicate \
  -i ~/source::~/source.db \
  -o ~/dest::~/dest.db \
  --no-validate-post-copy
```

**Default behavior**: Validation is enabled by default. Each copied file is hashed and compared to ensure integrity.

**Use `--no-validate-post-copy` when**:

- Performance is critical and you trust the copy operation
- Working with very large files where validation would take significant time
- You've already verified the source files are correct

**Keep validation enabled when**:

- Data integrity is critical
- Working with important or irreplaceable files
- You want to catch any copy errors immediately

#### -a, --hash-algorithm <algorithm>

Specify the hashing algorithm (default: sha256).

```bash
file-sentinel replicate \
  -i ~/source::~/source.db \
  -o ~/dest::~/dest.db \
  -a sha256
```

### What It Does

1. **Reads source digest** - Gets list of files to replicate
2. **Checks source integrity** - Verifies each file before copying
3. **Falls back to mirrors** - If source is corrupted, tries mirrors
4. **Copies files** - To destination directory
5. **Handles deletions** - Removes files not in source
6. **Updates destination digest** - Creates or updates with new state

### Output

```
Starting Replicate Operation
Source Directory: /home/user/Documents
Source Digest: /home/user/Documents/digest.db
Destination Directory: /backup/Documents
Destination Digest: /backup/Documents/digest.db
Subdirectory: (entire directory)
Mirrors: 2
Permanent Delete: false
Dry Run: false

Found 523 files in source digest
Found 518 files in destination digest
Replicating files...

REPLICATE Operation COMPLETED
Total Files Processed: 523
Total Bytes Processed: 4.2 GB
Execution Time: 00:15:43
Errors: 0

Files Copied: 7
Files Deleted: 2
Files Recovery Failed: 0
```

### Examples

**Simple replication**:

```bash
file-sentinel replicate \
  -i ~/Documents::~/docs.db \
  -o /backup/Documents::/backup/docs.db
```

**With mirrors for redundancy**:

```bash
file-sentinel replicate \
  -i ~/Documents::~/docs.db \
  -o /backup/Documents::/backup/docs.db \
  --mirror /mirror1/Documents::/mirror1/docs.db \
  --mirror /mirror2/Documents::/mirror2/docs.db
```

**Replicate only one folder**:

```bash
file-sentinel replicate \
  -i ~/Documents::~/docs.db \
  -o /backup/Documents::/backup/docs.db \
  -s photos
```

**With permanent deletion**:

```bash
file-sentinel replicate \
  -i ~/Documents::~/docs.db \
  -o /backup/Documents::/backup/docs.db \
  --perma-delete
```

## heal Command

Recover corrupted or missing files from mirrors.

### Syntax

```bash
file-sentinel heal \
  -i <directory>::<digest-file> \
  --mirror <mirror>::<mirror-digest> \
  [options]
```

### Required Options

#### -i, --input <directory>::<digest-file>

Specify the directory to heal and its digest.

```bash
-i ~/Documents::~/Documents/digest.db
```

#### --mirror <directory>::<digest-file>

Specify at least one mirror to use for recovery. Can be repeated.

```bash
--mirror /backup/Documents::/backup/digest.db
```

**At least one mirror is required** for heal command.

### Optional Options

#### -s, --subdirectory <path>

Heal only files in a specific subdirectory.

```bash
file-sentinel heal \
  -i ~/Documents::~/docs.db \
  --mirror /backup/Documents::/backup/docs.db \
  -s photos
```

#### -a, --hash-algorithm <algorithm>

Specify the hashing algorithm (default: sha256).

```bash
file-sentinel heal \
  -i ~/docs::~/docs.db \
  --mirror /backup/docs::/backup/docs.db \
  -a sha256
```

#### --validate-post-copy

Enable validation of copied files after healing by verifying their hash (default: enabled).

```bash
file-sentinel heal \
  -i ~/Documents::~/docs.db \
  --mirror /backup/Documents::/backup/docs.db \
  --validate-post-copy
```

To disable validation (faster but less safe):

```bash
file-sentinel heal \
  -i ~/Documents::~/docs.db \
  --mirror /backup/Documents::/backup/docs.db \
  --no-validate-post-copy
```

**Default behavior**: Validation is enabled by default. Each healed file is hashed and compared to ensure integrity.

**Use `--no-validate-post-copy` when**:

- Performance is critical and you trust the healing operation
- Working with very large files where validation would take significant time
- You've already verified the mirror files are correct

**Keep validation enabled when**:

- Data integrity is critical
- Working with important or irreplaceable files
- You want to catch any copy errors immediately

### What It Does

1. **Reads digest** - Gets expected state of all files
2. **Verifies each file** - Checks if file exists and matches hash
3. **Identifies problems** - Finds corrupted or missing files
4. **Tries mirrors** - Attempts to copy from each mirror sequentially
5. **Verifies copy** - Ensures recovered file matches expected hash (unless `--no-validate-post-copy` is used)
6. **Reports results** - Shows healed, verified, and failed files

### Output

```
Starting Heal Operation
Input Directory: /home/user/Documents
Digest File: /home/user/Documents/digest.db
Subdirectory: (entire directory)
Mirrors: 2
Dry Run: false

Found 523 files in digest
Healing files...

HEAL Operation COMPLETED
Total Files Processed: 523
Total Bytes Processed: 45 MB
Execution Time: 00:02:15
Errors: 0

Files Healed: 3
Files Verified: 520
Files Recovery Failed: 0
```

### Understanding Results

- **Files Healed** - Files that were corrupted and successfully recovered
- **Files Verified** - Files that were already correct (no healing needed)
- **Files Recovery Failed** - Files that couldn't be recovered from any mirror

### Examples

**Basic healing**:

```bash
file-sentinel heal \
  -i ~/Documents::~/docs.db \
  --mirror /backup/Documents::/backup/docs.db
```

**Multiple mirrors**:

```bash
file-sentinel heal \
  -i ~/Documents::~/docs.db \
  --mirror /backup1/Documents::/backup1/docs.db \
  --mirror /backup2/Documents::/backup2/docs.db
```

**Heal specific folder**:

```bash
file-sentinel heal \
  -i ~/Documents::~/docs.db \
  --mirror /backup/Documents::/backup/docs.db \
  -s photos/vacation
```

**Dry run to see what would be healed**:

```bash
file-sentinel heal \
  -i ~/Documents::~/docs.db \
  --mirror /backup/Documents::/backup/docs.db \
  --dry-run
```

## compare Command

Compare two digests to predict what a replicate operation would do.

### Syntax

```bash
file-sentinel compare --local <digest-file> --remote <digest-file> [options]
```

### Required Options

#### --local <digest-file>

Specify the local (source) digest file path.

```bash
--local ~/Documents/digest.db
```

#### --remote <digest-file>

Specify the remote (destination) digest file path.

```bash
--remote /backup/Documents/digest.db
```

### Optional Options

#### -s, --subdirectory <path>

Compare only files in a specific subdirectory.

```bash
file-sentinel compare \
  --local ~/Documents/digest.db \
  --remote /backup/Documents/digest.db \
  -s photos/2024
```

**Path is relative** to the directory root in the digest.

#### --verbose

Display detailed information about each file difference.

```bash
file-sentinel compare \
  --local ~/source/digest.db \
  --remote /backup/digest.db \
  --verbose
```

#### --panic-on-error

Exit immediately when an error occurs instead of continuing.

```bash
file-sentinel compare \
  --local ~/source/digest.db \
  --remote /backup/digest.db \
  --panic-on-error
```

#### --dry-run

This option is accepted but has no effect for compare (it's already a read-only operation).

#### --no-tty

Disable TTY mode to remove interactive features and ANSI colors.

```bash
file-sentinel compare \
  --local ~/source/digest.db \
  --remote /backup/digest.db \
  --no-tty
```

#### -t, --io-timeout <seconds>

Set the I/O timeout in seconds (default: 30). Not typically needed for compare since it only reads digest files.

### What It Does

1. **Reads both digests** - Opens and reads file information from both digest databases
2. **Compares file hashes** - Identifies differences between local and remote digests
3. **Categorizes changes** - Groups files into new, changed, and deleted
4. **Reports results** - Shows what would happen if replicate was run

### Output

```
Starting Compare Operation
================================================================================
Local Digest File: /home/user/Documents/digest.db (source)
Remote Digest File: /backup/Documents/digest.db (destination)
Dry Run: false

(compare-service)> Local database opened successfully
(compare-service)> Remote database opened successfully
(compare-service)> Found 523 files in local digest
(compare-service)> Found 518 files in remote digest
(compare-service)> Comparing digests...

COMPARISON RESULTS (Predicting Replicate: Local -> Remote)
================================================================================
New Files (would be copied to remote): 7
Changed Files (would be updated in remote): 2
Deleted Files (would be removed from remote): 3

New Files:
  + photos/vacation/IMG_001.jpg
  + documents/report.pdf
  ...

Changed Files:
  ~ documents/notes.txt
  ~ data/config.json

Deleted Files:
  - old/archive.zip
  - temp/file.tmp
  ...

COMPARE Operation COMPLETED
Total Files Processed: 523
Execution Time: 00:00:02
Errors: 0

New Files: 7
Changed Files: 2
Deleted Files: 3
```

### Understanding Results

- **New Files** - Files that exist in local digest but not in remote (would be copied)
- **Changed Files** - Files that exist in both but have different hashes (would be updated)
- **Deleted Files** - Files that exist in remote digest but not in local (would be removed)

### Important Notes

- **Read-only operation** - Compare only reads digest files, never reads or modifies actual files
- **Predictive** - Shows what would happen, not what has happened
- **Fast** - Works entirely with digest databases, no file I/O required
- **Digest files required** - Both digest files must exist before running compare

### Examples

**Basic comparison**:

```bash
file-sentinel compare \
  --local ~/Documents/digest.db \
  --remote /backup/Documents/digest.db
```

**Verbose output**:

```bash
file-sentinel compare \
  --local ~/Documents/digest.db \
  --remote /backup/Documents/digest.db \
  --verbose
```

**Compare before replicating**:

```bash
# Preview what would change
file-sentinel compare \
  --local ~/source/digest.db \
  --remote /backup/digest.db

# If looks good, perform the replication
file-sentinel replicate \
  -i ~/source::~/source/digest.db \
  -o /backup::/backup/digest.db
```

## Exit Codes

File Sentinel uses standard exit codes:

- **0** - Success, operation completed without errors
- **1** - Error occurred during operation

In scripts, check the exit code:

```bash
if file-sentinel verify -i ~/docs::~/docs.db; then
    echo "Verification passed"
else
    echo "Verification failed"
    exit 1
fi
```

## Environment Variables

File Sentinel does not currently use environment variables for configuration. All options must be specified on the command line.

## Progress Indicators

For large files (> 10 MB) that take more than 10 seconds to hash, progress is displayed every 10 seconds:

```
(crypto-service)> Hashing "large-video.mp4": 500 MB/2 GB (25%)
(crypto-service)> Hashing "large-video.mp4": 1.2 GB/2 GB (60%)
(crypto-service)> Hashing "large-video.mp4": 1.8 GB/2 GB (90%)
```

## Common Patterns

### Check Then Act

Verify before performing operations:

```bash
# Verify source is good
file-sentinel verify -i ~/source::~/source.db

# If good, replicate
file-sentinel replicate \
  -i ~/source::~/source.db \
  -o ~/dest::~/dest.db
```

### Preview Changes

Use compare or dry run to check what will happen:

```bash
# Option 1: Compare digests (fast, digest-only)
file-sentinel compare \
  --local ~/source/digest.db \
  --remote ~/dest/digest.db

# Option 2: Dry run replicate (slower, verifies actual files)
file-sentinel replicate \
  -i ~/source::~/source.db \
  -o ~/dest::~/dest.db \
  --dry-run

# If looks good, do it for real
file-sentinel replicate \
  -i ~/source::~/source.db \
  -o ~/dest::~/dest.db
```

### Multiple Mirrors

Always specify mirrors in order of preference (fastest/most reliable first):

```bash
file-sentinel heal \
  -i ~/data::~/data.db \
  --mirror /fast-local-backup/data::/fast-local-backup/data.db \
  --mirror /network-backup/data::/network-backup/data.db \
  --mirror /cloud-backup/data::/cloud-backup/data.db
```
