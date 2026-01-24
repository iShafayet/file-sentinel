# Core Concepts

This document explains the fundamental concepts behind File Sentinel and how they work together.

## Digests

A **digest** is the foundation of File Sentinel. It's a SQLite database that contains:

### What's Stored in a Digest

1. **File Information**
   - Relative path from the monitored directory
   - File size in bytes
   - Creation timestamp
   - Last modification timestamp
   - SHA-256 cryptographic hash
   - Last attempted timestamp (when the file was last processed)
   - Last attempt result (success, error message, or null)

2. **Summary Statistics**
   - Total number of files
   - Total size of all files
   - Digest creation time
   - Last update time

3. **Operation History**
   - Every command executed (digest, verify, replicate, heal)
   - When it started and completed
   - Whether it succeeded
   - Number of errors encountered

### Why Use Digests?

Digests serve several purposes:

- **Integrity Verification** - Detect if files have been corrupted or tampered with
- **Change Detection** - Identify what's changed between snapshots
- **Backup Coordination** - Know exactly what needs to be copied
- **Recovery Planning** - Understand what's available for restoration

## Hashing

File Sentinel uses **SHA-256** hashing to create unique fingerprints of files.

### What is a Hash?

A hash is a fixed-size string of characters that uniquely represents a file's contents. Even a tiny change to the file produces a completely different hash.

Example:
```
File: photo.jpg (2.3 MB)
Hash: 8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4
```

If a single byte changes in the file, the hash becomes entirely different:
```
Modified: photo.jpg (2.3 MB)
Hash: 3e23e8160039594a33894f6564e1b1348bbd7a0088d42c4acb73eeaed59c009d
```

### Why SHA-256?

- **Collision-resistant** - Virtually impossible for two different files to have the same hash
- **One-way** - Cannot reconstruct the file from its hash
- **Fast** - Can process large files efficiently
- **Standard** - Widely used and trusted in the industry

## The Five Commands

File Sentinel operates through five main commands, each serving a specific purpose.

### 1. Digest Command

**Purpose**: Create or update the file inventory.

**When to use**:
- First time monitoring a directory
- After making changes to files
- Before creating a backup
- Periodically to track changes

**What it does**:
- Scans all files in the directory
- Calculates hashes for new or modified files
- Updates the digest database
- Removes entries for deleted files

### 2. Verify Command

**Purpose**: Check if files match their recorded state.

**When to use**:
- Periodically to ensure data integrity
- After transferring files
- When you suspect corruption
- Before important operations

**What it does**:
- Compares current files against the digest
- Reports files that don't match (corrupted)
- Identifies missing files
- Finds unexpected files

### 3. Replicate Command

**Purpose**: Copy files to another location with verification.

**When to use**:
- Creating backups
- Moving data to another system
- Synchronizing directories
- Migrating to new storage

**What it does**:
- Verifies source files before copying
- Falls back to mirrors if source is corrupted
- Creates digest for destination
- Handles files that should be removed from destination
- Skips files that already exist in destination (with optional hash verification)

**Performance optimization**: Use `--trust-dest-digest` to skip hash verification for existing files, significantly speeding up incremental replications when you trust the destination digest.

### 4. Heal Command

**Purpose**: Fix corrupted files using backup copies.

**When to use**:
- After detecting corruption
- After hardware failures
- When files won't open correctly
- To restore from backups

**What it does**:
- Checks each file against its hash
- Replaces corrupted files with good copies from mirrors
- Verifies the replacement was successful
- Reports files that couldn't be fixed

### 5. Compare Command

**Purpose**: Compare two digests to predict what a replicate operation would do.

**When to use**:
- Before running replicate to see what would change
- To understand differences between source and destination
- To plan synchronization operations
- To verify backup state without reading actual files

**What it does**:
- Reads both digest databases
- Compares file hashes between local and remote
- Reports new files (would be copied)
- Reports changed files (would be updated)
- Reports deleted files (would be removed)
- Does not read or modify actual files (digest-only operation)

## Attempt Tracking and Recency Threshold

File Sentinel tracks when each file was last processed to enable intelligent resumption of interrupted operations.

### How Attempt Tracking Works

Every time a file is processed (during digest, verify, replicate, or heal operations), File Sentinel:

1. **Records the timestamp** - Updates `last_attempted_at` with the current time
2. **Records the result** - Stores `last_attempt_result` (e.g., "success", "Missing file", or error message)
3. **Orders files intelligently** - Files are ordered so that:
   - Never-attempted files (timestamp = 0) are processed first
   - Oldest attempted files come next (files that haven't been touched in the longest time)
   - Most recently attempted files come last
   - This ensures progress is made even when operations are interrupted, prioritizing files that need attention

### Recency Threshold

The `--recency-threshold` option allows you to skip files that were processed within a specified time window (in seconds).

**How it works**:

- When set to a value > 0, files processed within that threshold are skipped
- Never-attempted files are always processed (regardless of threshold)
- Skipped files are logged with a clear message showing how long ago they were processed
- The database still returns all files; filtering happens in application code

**Example**:

```bash
# Skip files processed in the last hour
file-sentinel verify -i ~/docs::~/docs.db --recency-threshold 3600
```

If a file was processed 30 minutes ago and the threshold is 3600 seconds (1 hour), you'll see:
```
Skipping file.txt - processed 30 minutes ago (within 3600 second threshold)
```

### Why This Matters

**Resume Interrupted Operations**:
- If a verify operation is interrupted after processing 1000 files, you can resume and skip those already processed
- No need to start from the beginning
- Progress is preserved across multiple runs

**Incremental Processing**:
- Process only files that haven't been touched recently
- Useful for large directories where you want to focus on new or changed files
- Avoid redundant work on files that were just processed

**Progress Preservation**:
- Even if operations are continuously interrupted, you keep making progress
- Files that were never attempted or attempted longest ago are prioritized
- The system naturally focuses on files that need attention

### Default Behavior

By default, `--recency-threshold` is 0, meaning all files are processed regardless of when they were last attempted. This ensures backward compatibility and predictable behavior.

## Mirrors

A **mirror** is a backup copy of your directory that can be used as a fallback source.

### How Mirrors Work

When File Sentinel needs a file (during replicate or heal), it:

1. Tries the primary source first
2. If that fails, tries the first mirror
3. If that fails, tries the second mirror
4. Continues until it finds a valid copy or runs out of mirrors

### Why Use Mirrors?

Mirrors provide redundancy:

- **Hardware failure protection** - If a drive fails, mirrors provide backup sources
- **Corruption recovery** - If files get corrupted, clean copies are available
- **Network issues** - If one location is unreachable, try another
- **Data safety** - Multiple copies reduce the risk of total data loss

### Setting Up Mirrors

Each mirror needs:
1. A directory with files
2. A digest for that directory

Example:
```bash
# Create mirror
cp -r ~/Documents /backup/docs-mirror
file-sentinel digest -i /backup/docs-mirror::/backup/docs-mirror.db

# Use mirror for healing
file-sentinel heal \
  -i ~/Documents::~/Documents/digest.db \
  --mirror /backup/docs-mirror::/backup/docs-mirror.db
```

## Subdirectories

You can limit operations to specific subdirectories using the `-s` option.

### Why Use Subdirectories?

- **Targeted verification** - Check only a specific folder
- **Partial replication** - Copy only what you need
- **Selective healing** - Fix files in one area
- **Performance** - Work with smaller subsets

### Example Usage

```bash
# Only verify photos from 2024
file-sentinel verify \
  -i ~/Documents::~/Documents.db \
  -s photos/2024

# Only replicate the reports folder
file-sentinel replicate \
  -i ~/Work::~/Work.db \
  -o /backup/Work::/backup/Work.db \
  -s reports
```

## File Deletion Handling

When files are removed during replication, File Sentinel offers two approaches.

### Recycle Bin (Default)

By default, deleted files are moved to a `.fs-recycle` directory with timestamps:

```
original location: /backup/old-file.txt
recycled to: /backup/.fs-recycle/1734364800000_old-file.txt
```

The number is a timestamp, allowing multiple versions to coexist without conflicts.

**Advantages**:
- Can recover accidentally deleted files
- Safe - nothing is permanently lost immediately
- Audit trail of what was removed

### Permanent Delete

Use the `--perma-delete` flag to skip the recycle bin:

```bash
file-sentinel replicate \
  -i ~/source::~/source.db \
  -o ~/dest::~/dest.db \
  --perma-delete
```

**Use when**:
- Storage space is limited
- Files are confidential and shouldn't remain
- You're certain you won't need them back

## Ignored Files

File Sentinel automatically ignores certain items:

### What Gets Ignored

1. **The recycle bin** - `.fs-recycle` directories are never processed
2. **Symbolic links** - Links are not followed or included
3. **Special files** - Sockets, device files, named pipes (FIFOs)

### Why These Are Ignored

- **Recycle bin** - Prevents including deleted files in digests
- **Symbolic links** - Avoids circular references and complexity
- **Special files** - These are system-level constructs, not regular files

## Dry Run Mode

The `--dry-run` option lets you preview what would happen without making changes.

### What Gets Simulated

- Which files would be added/updated/deleted in digests
- Which files would be copied during replication
- Which files would be healed

### What Doesn't Happen

- No database modifications
- No files copied or moved
- No digest files created
- Operation logs are not written

### When to Use Dry Run

- Testing commands before real execution
- Checking if the right files will be affected
- Estimating how long an operation might take
- Verifying your command syntax is correct

## Error Handling

File Sentinel can handle errors in two ways:

### Continue Mode (Default)

When errors occur:
- Log the error
- Continue processing other files
- Report all errors at the end

This is useful for:
- Large operations where some failures are acceptable
- Scenarios where you want a complete picture of all issues
- Automated scripts that should complete regardless

### Panic Mode

With `--panic-on-error`, the tool:
- Stops immediately on the first error
- Rolls back any database transactions
- Exits with error code

This is useful for:
- Critical operations where failure is unacceptable
- Scripts that need to know something went wrong
- Testing and validation scenarios

## Performance Considerations

### Hashing Speed

Hashing is CPU-intensive. For large files (> 10 MB):
- Progress is shown every 10 seconds
- Streaming is used to avoid loading entire files into memory
- Multiple files are processed sequentially

### Database Performance

Digest files use SQLite with:
- **WAL mode** - Better concurrency and crash resistance
- **Indexed paths** - Fast lookups by file path
- **Transactions** - All-or-nothing updates for consistency

### Network Considerations

When working with network drives:
- Hashing requires reading the entire file (slower over network)
- Store digests locally when possible
- Consider using mirrors on faster storage

## Best Practices

### Regular Digests

Update your digests regularly:
- **Daily** - For actively changing data
- **Weekly** - For work in progress
- **After major changes** - When you add, remove, or modify many files
- **Before backups** - Ensure your backup source is current

### Multiple Mirrors

For critical data:
- Keep at least two mirrors
- Store mirrors in different physical locations
- Update mirrors regularly
- Verify mirrors periodically

### Testing Your Setup

Before relying on File Sentinel:
1. Test with non-critical data first
2. Verify you can recover files using heal
3. Practice the full workflow
4. Document your process for future reference

### Monitoring

Keep track of:
- When digests were last updated
- Verification results (should have no failures)
- Disk space for mirrors
- Operation logs in digest files

