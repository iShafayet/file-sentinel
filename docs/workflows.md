# Common Workflows

This guide provides practical examples for real-world scenarios.

## Basic Backup Workflow

A simple workflow for backing up a directory regularly.

### Initial Setup

**Step 1**: Create digest for your source directory

```bash
file-sentinel digest -i ~/Documents::~/Documents/digest.db
```

**Step 2**: Create the first backup

```bash
file-sentinel replicate \
  -i ~/Documents::~/Documents/digest.db \
  -o /backup/Documents::/backup/Documents/digest.db
```

### Regular Updates

**Step 1**: Update source digest (do this after making changes)

```bash
file-sentinel digest -i ~/Documents::~/Documents/digest.db
```

**Step 2** (Optional): Preview what would change

```bash
file-sentinel compare \
  --local ~/Documents/digest.db \
  --remote /backup/Documents/digest.db
```

This shows what files would be copied, updated, or deleted without actually performing the operation.

**Step 3**: Sync changes to backup

```bash
file-sentinel replicate \
  -i ~/Documents::~/Documents/digest.db \
  -o /backup/Documents::/backup/Documents/digest.db
```

### Verification

Periodically verify both source and backup:

```bash
# Verify source
file-sentinel verify -i ~/Documents::~/Documents/digest.db

# Verify backup
file-sentinel verify -i /backup/Documents::/backup/Documents/digest.db
```

## Setting Up Mirrors

Create multiple backup copies for redundancy.

### Three-Copy Strategy

A good practice is to have:

1. Original (working copy)
2. Local backup (fast recovery)
3. Off-site backup (disaster recovery)

### Setup Process

**Step 1**: Create digests for all locations

```bash
# Original
file-sentinel digest -i ~/Documents::~/Documents/digest.db

# Local backup
file-sentinel digest -i /backup/Documents::/backup/digest.db

# Off-site (external drive or network)
file-sentinel digest -i /mnt/external/Documents::/mnt/external/digest.db
```

**Step 2**: Replicate to both backups

```bash
# To local backup
file-sentinel replicate \
  -i ~/Documents::~/Documents/digest.db \
  -o /backup/Documents::/backup/digest.db

# To off-site backup
file-sentinel replicate \
  -i ~/Documents::~/Documents/digest.db \
  -o /mnt/external/Documents::/mnt/external/digest.db
```

**Step 3**: Configure healing with both mirrors

```bash
file-sentinel heal \
  -i ~/Documents::~/Documents/digest.db \
  --mirror /backup/Documents::/backup/digest.db \
  --mirror /mnt/external/Documents::/mnt/external/digest.db
```

## Recovering from Corruption

What to do when you detect corrupted files.

### Step 1: Verify to Find Problems

```bash
file-sentinel verify -i ~/Documents::~/Documents/digest.db --verbose
```

Look for "Files Failed" in the output. These are corrupted files.

### Step 2: Heal from Mirrors

```bash
file-sentinel heal \
  -i ~/Documents::~/Documents/digest.db \
  --mirror /backup/Documents::/backup/digest.db \
  --verbose
```

### Step 3: Verify Fix

```bash
file-sentinel verify -i ~/Documents::~/Documents/digest.db
```

Should now show zero failed files.

### If Healing Fails

If a file couldn't be healed:

1. Check mirror integrity: `file-sentinel verify -i /backup/Documents::/backup/digest.db`
2. Try additional mirrors if available
3. Manually restore from other backups
4. Update digest if file is permanently lost

## Previewing Changes Before Replication

Use the compare command to see what would change before running replicate.

### Why Compare First?

- **Fast** - Only reads digest files, no file I/O
- **Safe** - Preview without risk
- **Informative** - See exactly what would be copied, updated, or deleted

### Example Workflow

```bash
# 1. Update source digest after making changes
file-sentinel digest -i ~/Documents::~/Documents/digest.db

# 2. Compare to see what would change
file-sentinel compare \
  --local ~/Documents/digest.db \
  --remote /backup/Documents/digest.db

# 3. Review the output, then replicate if everything looks good
file-sentinel replicate \
  -i ~/Documents::~/Documents/digest.db \
  -o /backup/Documents::/backup/Documents/digest.db
```

### When to Use Compare

- Before large replication operations
- When you want to verify backup state
- To understand differences between locations
- In automated scripts to check if replication is needed

## Incremental Backups

Update only what changed since last backup.

### How It Works

File Sentinel automatically handles incremental backups:

- Only changed files are copied
- Unchanged files are skipped
- Deleted files are removed

### Daily Backup Script

Create a script `daily-backup.sh`:

```bash
#!/bin/bash

echo "$(date): Starting daily backup"

# Update source digest
echo "Updating source digest..."
file-sentinel digest -i ~/Documents::~/Documents/digest.db

# Sync to backup
echo "Syncing to backup..."
file-sentinel replicate \
  -i ~/Documents::~/Documents/digest.db \
  -o /backup/Documents::/backup/Documents/digest.db

# Verify backup
echo "Verifying backup..."
if file-sentinel verify -i /backup/Documents::/backup/Documents/digest.db; then
    echo "$(date): Backup completed successfully"
else
    echo "$(date): Backup verification failed!"
    exit 1
fi
```

Make it executable and run:

```bash
chmod +x daily-backup.sh
./daily-backup.sh
```

## Working with Large Files

Special considerations for large files (videos, disk images, etc.).

### Progress Monitoring

Use `--verbose` to see progress:

```bash
file-sentinel digest -i ~/Videos::~/Videos/digest.db --verbose
```

For files > 10 MB, progress is shown every 10 seconds:

```
(crypto-service)> Hashing "movie.mp4": 1.2 GB/4.5 GB (27%)
```

### Timeout Adjustment

Increase timeout for very large files on slow storage:

```bash
file-sentinel digest \
  -i /slowdrive/Videos::/slowdrive/digest.db \
  -t 300
```

### Selective Processing

Process only specific subdirectories:

```bash
# Only digest 2024 videos
file-sentinel digest -i ~/Videos::~/Videos/digest.db -s 2024
```

## Automated Healing with Cron

Set up automatic corruption detection and repair.

### Weekly Verification

Check for corruption every week (Sundays at 2 AM):

```bash
crontab -e
```

Add this line:

```cron
0 2 * * 0 /usr/local/bin/file-sentinel verify -i /home/user/Documents::/home/user/Documents/digest.db
```

### Auto-Heal on Failure

Create a script `verify-and-heal.sh`:

```bash
#!/bin/bash

DOCS_DIR=~/Documents
DOCS_DIGEST=~/Documents/digest.db
MIRROR_DIR=/backup/Documents
MIRROR_DIGEST=/backup/Documents/digest.db

# Verify
if ! file-sentinel verify -i $DOCS_DIR::$DOCS_DIGEST; then
    echo "Corruption detected! Attempting to heal..."

    # Heal from mirror
    file-sentinel heal \
        -i $DOCS_DIR::$DOCS_DIGEST \
        --mirror $MIRROR_DIR::$MIRROR_DIGEST

    # Verify again
    if file-sentinel verify -i $DOCS_DIR::$DOCS_DIGEST; then
        echo "Healing successful!"
    else
        echo "Healing failed! Manual intervention required."
        # Send alert (email, notification, etc.)
    fi
fi
```

Schedule it:

```cron
0 3 * * * /home/user/scripts/verify-and-heal.sh >> /var/log/file-sentinel.log 2>&1
```

## Migrating to New Storage

Move data to a new drive or system.

### Step 1: Verify Source

Ensure source data is good before migration:

```bash
file-sentinel verify -i ~/Documents::~/Documents/digest.db
```

### Step 2: Copy Files

Use operating system tools to copy files:

```bash
cp -r ~/Documents /newdrive/Documents
```

### Step 3: Create Digest for New Location

```bash
file-sentinel digest -i /newdrive/Documents::/newdrive/digest.db
```

### Step 4: Verify Copy

Check that new location matches old:

```bash
# This should show identical file counts and hashes
file-sentinel verify -i /newdrive/Documents::/newdrive/digest.db
```

### Alternative: Use Replicate

Let File Sentinel handle the entire process:

```bash
file-sentinel replicate \
  -i ~/Documents::~/Documents/digest.db \
  -o /newdrive/Documents::/newdrive/digest.db
```

This method:

- Verifies source before copying
- Creates destination digest automatically
- Handles errors gracefully

## Partial Directory Sync

Sync only specific folders between locations.

### Example: Sync Only Recent Photos

```bash
file-sentinel replicate \
  -i ~/Photos::~/Photos/digest.db \
  -o /backup/Photos::/backup/Photos/digest.db \
  -s 2024
```

### Example: Multiple Subdirectories

For multiple subdirectories, run separate commands:

```bash
# Sync work documents
file-sentinel replicate \
  -i ~/Documents::~/Documents/digest.db \
  -o /backup/Documents::/backup/Documents/digest.db \
  -s work

# Sync personal documents
file-sentinel replicate \
  -i ~/Documents::~/Documents/digest.db \
  -o /backup/Documents::/backup/Documents/digest.db \
  -s personal
```

## Testing Your Backup Strategy

Verify your backup system works before you need it.

### Test 1: Corruption Recovery

1. Create a test file:

   ```bash
   echo "original content" > ~/Documents/test.txt
   ```

2. Digest it:

   ```bash
   file-sentinel digest -i ~/Documents::~/Documents/digest.db
   ```

3. Backup it:

   ```bash
   file-sentinel replicate \
     -i ~/Documents::~/Documents/digest.db \
     -o /backup/Documents::/backup/digest.db
   ```

4. Corrupt it:

   ```bash
   echo "corrupted!" > ~/Documents/test.txt
   ```

5. Verify corruption is detected:

   ```bash
   file-sentinel verify -i ~/Documents::~/Documents/digest.db
   ```

6. Heal it:

   ```bash
   file-sentinel heal \
     -i ~/Documents::~/Documents/digest.db \
     --mirror /backup/Documents::/backup/digest.db
   ```

7. Verify fix:
   ```bash
   file-sentinel verify -i ~/Documents::~/Documents/digest.db
   cat ~/Documents/test.txt  # Should show "original content"
   ```

### Test 2: Complete Recovery

Simulate complete data loss:

1. Create and backup test directory:

   ```bash
   mkdir -p ~/test-recovery
   echo "data" > ~/test-recovery/file.txt
   file-sentinel digest -i ~/test-recovery::~/test-recovery.db
   file-sentinel replicate \
     -i ~/test-recovery::~/test-recovery.db \
     -o /backup/test::/backup/test.db
   ```

2. Delete everything:

   ```bash
   rm -rf ~/test-recovery
   mkdir ~/test-recovery
   ```

3. Recover:

   ```bash
   file-sentinel replicate \
     -i /backup/test::/backup/test.db \
     -o ~/test-recovery::~/test-recovery.db
   ```

4. Verify:
   ```bash
   cat ~/test-recovery/file.txt  # Should show "data"
   ```

## Maintaining Digest Files

Keep digest files organized and up to date.

### Regular Digest Updates

Update digests on a schedule based on data change frequency:

**Frequently changing (daily updates)**:

```bash
# Work documents
file-sentinel digest -i ~/Work::~/Work/digest.db
```

**Moderate changes (weekly updates)**:

```bash
# Personal documents
file-sentinel digest -i ~/Documents::~/Documents/digest.db
```

**Rarely changing (monthly verification)**:

```bash
# Archived photos
file-sentinel verify -i ~/Photos/Archive::~/Photos/Archive/digest.db
```

### Digest File Locations

**Option 1: With the data** (simple)

```
~/Documents/
├── digest.db
├── file1.pdf
└── file2.pdf
```

**Option 2: Separate directory** (organized)

```
~/digests/
├── documents.db
├── photos.db
└── work.db
```

**Option 3: With backups** (centralized)

```
/backup/
├── documents/
│   ├── files...
│   └── digest.db
└── photos/
    ├── files...
    └── digest.db
```

### Digest File Cleanup

Digest files grow over time. To start fresh:

```bash
# Delete old digest
rm ~/Documents/digest.db

# Create new one
file-sentinel digest -i ~/Documents::~/Documents/digest.db
```

Operation history and old records will be removed.

## Multi-Machine Sync

Keep directories synchronized across multiple computers.

### Setup on Each Machine

**Machine A** (primary):

```bash
file-sentinel digest -i ~/Documents::~/Documents/digest.db
```

**Machine B** (secondary):

```bash
file-sentinel digest -i ~/Documents::~/Documents/digest.db
```

**Shared backup** (network drive or cloud):

```bash
file-sentinel digest -i /shared/Documents::/shared/Documents/digest.db
```

### Sync Process

**From Machine A to shared**:

```bash
file-sentinel replicate \
  -i ~/Documents::~/Documents/digest.db \
  -o /shared/Documents::/shared/Documents/digest.db
```

**From shared to Machine B**:

```bash
file-sentinel replicate \
  -i /shared/Documents::/shared/Documents/digest.db \
  -o ~/Documents::~/Documents/digest.db
```

### Avoiding Conflicts

To prevent conflicts:

1. Designate one machine as primary
2. Always sync from primary to shared
3. Other machines sync from shared
4. Never modify files on multiple machines simultaneously

## Cleaning Up Old Backups

Manage storage space with selective deletion.

### Review Recycle Bin

Check what's in the recycle bin:

```bash
ls -la /backup/Documents/.fs-recycle/
```

Files are named with timestamps (milliseconds since epoch):

```
1734364800000_old-file.txt
1734451200000_old-file.txt
```

### Recover from Recycle Bin

To recover a file:

```bash
cp /backup/Documents/.fs-recycle/1734364800000_file.txt \
   /backup/Documents/file.txt
```

### Empty Recycle Bin

When you're sure you don't need the files:

```bash
rm -rf /backup/Documents/.fs-recycle/*
```

### Use Permanent Delete

For future replications, use `--perma-delete` to skip the recycle bin:

```bash
file-sentinel replicate \
  -i ~/source::~/source.db \
  -o ~/dest::~/dest.db \
  --perma-delete
```
