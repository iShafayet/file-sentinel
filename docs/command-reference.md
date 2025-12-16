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

### What It Does

1. **Reads digest** - Gets expected state of all files
2. **Verifies each file** - Checks if file exists and matches hash
3. **Identifies problems** - Finds corrupted or missing files
4. **Tries mirrors** - Attempts to copy from each mirror sequentially
5. **Verifies copy** - Ensures recovered file matches expected hash
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

Use dry run to check what will happen:

```bash
# See what would be copied
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

