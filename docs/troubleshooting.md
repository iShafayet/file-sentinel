# Troubleshooting

This guide helps you resolve common issues with File Sentinel.

## Installation Issues

### Command Not Found

**Problem**: After installation, `file-sentinel` command is not recognized.

**Solution 1**: Check if npm global bin is in PATH

```bash
# Check npm global bin location
npm config get prefix

# On Linux/macOS, add to ~/.bashrc or ~/.zshrc:
export PATH="$PATH:$(npm config get prefix)/bin"

# Reload shell configuration
source ~/.bashrc  # or source ~/.zshrc
```

**Solution 2**: Reinstall globally

```bash
npm install -g file-sentinel --force
```

**Solution 3**: Use npx (temporary)

```bash
npx file-sentinel --help
```

### Permission Errors During Installation

**Problem**: "EACCES" or permission denied errors during `npm install -g`.

**On Linux/macOS**:

```bash
# Option 1: Fix npm permissions (recommended)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Then install
npm install -g file-sentinel

# Option 2: Use sudo (not recommended)
sudo npm install -g file-sentinel
```

**On Windows**:
- Run Command Prompt or PowerShell as Administrator
- Then run: `npm install -g file-sentinel`

### Module Not Found Errors

**Problem**: Error about missing modules like "better-sqlite3".

**Solution**: Reinstall dependencies

```bash
cd /path/to/file-sentinel
npm install
npm run build
```

## Runtime Errors

### Database Errors

**Problem**: "Database is not open" or "failed to open database".

**Causes**:
1. Digest file is corrupted
2. Insufficient permissions
3. Disk is full

**Solutions**:

Check file permissions:
```bash
ls -l path/to/digest.db
```

Check disk space:
```bash
df -h
```

If digest is corrupted, recreate it:
```bash
rm path/to/digest.db
file-sentinel digest -i /path/to/dir::/path/to/digest.db
```

### Path Separator Errors

**Problem**: "Invalid input format" when specifying paths.

**Cause**: Using single colon `:` instead of double colon `::`.

**Wrong**:
```bash
file-sentinel digest -i ~/Documents:/digest.db
```

**Correct**:
```bash
file-sentinel digest -i ~/Documents::/digest.db
```

### Cannot Read File Errors

**Problem**: Errors reading specific files.

**Causes**:
1. File locked by another program
2. Insufficient permissions
3. File on unmounted drive
4. Network timeout

**Solutions**:

Check file permissions:
```bash
ls -l /path/to/problem-file
```

Close programs using the file:
```bash
# On Linux
lsof /path/to/problem-file

# On macOS
lsof /path/to/problem-file

# On Windows
# Use Task Manager or Resource Monitor
```

Increase timeout:
```bash
file-sentinel digest -i ~/dir::~/digest.db -t 120
```

Skip problematic files (continue on error):
```bash
# Don't use --panic-on-error
file-sentinel digest -i ~/dir::~/digest.db
```

## Performance Issues

### Very Slow Hashing

**Problem**: Digest creation takes extremely long.

**Causes**:
1. Working with network drives
2. Many small files
3. A few very large files
4. Slow storage (old HDD, USB 2.0)

**Solutions**:

Use verbose mode to see what's being processed:
```bash
file-sentinel digest -i ~/dir::~/digest.db --verbose
```

Store digest locally even if data is remote:
```bash
# Data on network, digest local
file-sentinel digest -i /mnt/network-drive::~/local-digest.db
```

For very large files, be patient. Progress is shown every 10 seconds:
```
(crypto-service)> Hashing "large-file.iso": 2 GB/8 GB (25%)
```

Consider processing subdirectories separately:
```bash
file-sentinel digest -i ~/large-dir::~/digest.db -s subdir1
file-sentinel digest -i ~/large-dir::~/digest.db -s subdir2
```

### High Memory Usage

**Problem**: File Sentinel uses too much memory.

**Explanation**: File Sentinel uses streaming for large files (>10 MB) to minimize memory usage. Memory usage should be modest even for large files.

If experiencing issues:
- Close other applications
- Process smaller subdirectories
- Check for other system issues

### Disk Space Issues

**Problem**: Running out of disk space during operations.

**Causes**:
1. Recycle bin accumulating deleted files
2. Multiple digest files
3. Log files growing

**Solutions**:

Empty recycle bin:
```bash
rm -rf /path/to/directory/.fs-recycle/*
```

Use permanent delete:
```bash
file-sentinel replicate \
  -i ~/source::~/source.db \
  -o ~/dest::~/dest.db \
  --perma-delete
```

Check digest file sizes:
```bash
ls -lh *digest.db
```

Recreate large digest files:
```bash
rm old-digest.db
file-sentinel digest -i ~/dir::~/new-digest.db
```

## Verification Failures

### Files Failing Verification

**Problem**: Verify command reports failed files.

**This means**: Files on disk don't match their stored hashes.

**Possible causes**:
1. **File corruption** - Hardware issues, bit rot
2. **Intentional changes** - You or a program modified the files
3. **Outdated digest** - Digest wasn't updated after changes

**What to do**:

**If files were intentionally changed**:
```bash
# Update the digest
file-sentinel digest -i ~/dir::~/digest.db
```

**If files are corrupted**:
```bash
# Heal from backup
file-sentinel heal \
  -i ~/dir::~/digest.db \
  --mirror /backup/dir::/backup/digest.db
```

**If unsure**:
```bash
# Check the file manually
file /path/to/failed-file
cat /path/to/failed-file  # if it's text
```

### Too Many "Extra Files"

**Problem**: Verify reports many extra files (files not in digest).

**Cause**: Digest is outdated.

**Solution**:
```bash
# Update the digest to include new files
file-sentinel digest -i ~/dir::~/digest.db
```

### Missing Files

**Problem**: Verify reports missing files (in digest but not on disk).

**Possible causes**:
1. Files were deleted
2. Directory was moved
3. Drive not mounted

**Solutions**:

If files are truly gone and you have backups:
```bash
# Recover from backup
file-sentinel heal \
  -i ~/dir::~/digest.db \
  --mirror /backup/dir::/backup/digest.db
```

If files were intentionally deleted:
```bash
# Update digest to remove entries
file-sentinel digest -i ~/dir::~/digest.db
```

If directory was moved:
```bash
# Create digest at new location
file-sentinel digest -i /new/location::/new/location/digest.db
```

## Replication Issues

### Files Not Being Copied

**Problem**: Replicate command shows "Files Copied: 0" but you expect changes.

**Possible causes**:
1. Source digest is outdated
2. Files haven't actually changed
3. Destination already up to date

**Solutions**:

Update source digest first:
```bash
file-sentinel digest -i ~/source::~/source.db
```

Then replicate:
```bash
file-sentinel replicate \
  -i ~/source::~/source.db \
  -o ~/dest::~/dest.db
```

Use dry-run to see what would happen:
```bash
file-sentinel replicate \
  -i ~/source::~/source.db \
  -o ~/dest::~/dest.db \
  --dry-run
```

### "No Valid Source Found"

**Problem**: Replication fails with "No valid source found" errors.

**Cause**: Source file is corrupted and mirrors (if any) don't have the file or are also corrupted.

**Solutions**:

Verify source:
```bash
file-sentinel verify -i ~/source::~/source.db
```

If source is corrupted, heal it first:
```bash
file-sentinel heal \
  -i ~/source::~/source.db \
  --mirror /backup/source::/backup/source.db
```

Then replicate:
```bash
file-sentinel replicate \
  -i ~/source::~/source.db \
  -o ~/dest::~/dest.db
```

### Unwanted File Deletions

**Problem**: Replication deleted files you wanted to keep.

**Solution**: Files are in the recycle bin unless `--perma-delete` was used.

Recover from recycle bin:
```bash
# List recycled files
ls -la /destination/.fs-recycle/

# Recover a file (remove timestamp prefix)
cp /destination/.fs-recycle/1734364800000_file.txt \
   /destination/file.txt
```

**Prevention**: Use dry-run first to preview changes:
```bash
file-sentinel replicate \
  -i ~/source::~/source.db \
  -o ~/dest::~/dest.db \
  --dry-run
```

## Healing Issues

### Healing Fails

**Problem**: Heal command can't recover files.

**Cause**: Mirrors don't have valid copies.

**Solutions**:

Verify mirrors:
```bash
file-sentinel verify -i /mirror1/dir::/mirror1/digest.db
file-sentinel verify -i /mirror2/dir::/mirror2/digest.db
```

Ensure mirrors have the files:
```bash
# Check if file exists in mirror
ls -l /mirror1/dir/path/to/file
```

Update mirror digests if outdated:
```bash
file-sentinel digest -i /mirror1/dir::/mirror1/digest.db
```

### "At Least One Mirror Required"

**Problem**: Error when running heal command.

**Cause**: No `--mirror` option specified.

**Solution**: Heal requires at least one mirror:
```bash
file-sentinel heal \
  -i ~/dir::~/digest.db \
  --mirror /backup/dir::/backup/digest.db
```

## Platform-Specific Issues

### Windows Path Issues

**Problem**: Errors with Windows paths containing backslashes.

**Solutions**:

Use forward slashes (works on Windows):
```bash
file-sentinel digest -i C:/Users/John/Documents::C:/Users/John/digest.db
```

Or use double backslashes:
```bash
file-sentinel digest -i C:\\Users\\John\\Documents::C:\\Users\\John\\digest.db
```

Or quote the path:
```bash
file-sentinel digest -i "C:\Users\John\Documents::C:\Users\John\digest.db"
```

### macOS Permission Issues

**Problem**: Cannot access certain directories on macOS.

**Cause**: macOS security restrictions (especially for Documents, Downloads, etc.).

**Solution**: Grant Terminal/Command Line Tools access in System Preferences:

1. Open System Preferences
2. Go to Security & Privacy
3. Select Privacy tab
4. Select "Full Disk Access"
5. Add Terminal or your terminal app

### Linux SELinux Denials

**Problem**: Permission denied errors even with correct file permissions.

**Cause**: SELinux policies blocking access.

**Solutions**:

Check SELinux status:
```bash
sestatus
```

Temporarily set to permissive mode (testing only):
```bash
sudo setenforce 0
```

Add proper SELinux context (recommended):
```bash
chcon -R -t user_home_t ~/Documents
```

Or disable SELinux for this operation.

## Common Error Messages

### "Invalid input format"

**Cause**: Incorrect path format.

**Fix**: Use `::` separator:
```bash
-i /path/to/dir::/path/to/digest.db
```

### "Directory does not exist"

**Cause**: Specified directory not found.

**Fix**: Check path spelling and ensure directory exists:
```bash
ls /path/to/directory
```

### "Digest file does not exist"

**Context**: Running verify, replicate, or heal.

**Fix**: Create digest first:
```bash
file-sentinel digest -i /path/to/dir::/path/to/digest.db
```

### "Operation failed"

**Generic error**. Check the error messages above for details.

**Get more information**:
```bash
# Use verbose mode
file-sentinel command -i path::digest.db --verbose
```

Look at the specific error messages to identify the problem.

## Getting Help

If you can't resolve an issue:

### Collect Information

1. **Command used**:
   ```bash
   # The exact command you ran
   file-sentinel digest -i ~/docs::~/digest.db
   ```

2. **Error message**:
   ```
   # Full error output (use --verbose)
   ```

3. **Environment**:
   ```bash
   # OS and version
   uname -a  # Linux/macOS
   ver  # Windows
   
   # Node.js version
   node --version
   
   # File Sentinel version
   file-sentinel --version
   ```

4. **File information** (if relevant):
   ```bash
   ls -l /path/to/problematic-file
   file /path/to/problematic-file
   ```

### Report Issue

Open an issue on the project repository with:
- Description of the problem
- What you expected to happen
- What actually happened
- Information collected above
- Steps to reproduce

## Performance Considerations

### Optimization Tips

**For many small files**:
- Process is I/O bound
- Use faster storage (SSD)
- Ensure good connection for network drives

**For few large files**:
- Process is CPU bound (hashing)
- Progress shown every 10 seconds for files taking longer than 10 seconds to hash
- Be patient, hashing is thorough

**For network storage**:
- Store digests locally
- Use wired connections when possible
- Avoid WiFi for large operations
- Consider processing during off-peak hours

### Benchmarks

Approximate speeds (will vary by hardware):

**Hashing speed** (SHA-256):
- Modern SSD: 300-500 MB/s
- HDD: 100-150 MB/s
- USB 3.0: 50-100 MB/s
- Network (gigabit): 50-100 MB/s
- USB 2.0: 20-30 MB/s

**Example**: 100 GB of data
- Fast SSD: 3-5 minutes
- HDD: 10-15 minutes
- USB 3.0: 15-30 minutes
- Network: 15-30 minutes

These are estimates. Actual time depends on file sizes, CPU speed, and system load.

## Best Practices to Avoid Issues

### Before Starting

1. **Test with small directories first**
2. **Ensure sufficient disk space** (at least 10% free)
3. **Close other intensive applications**
4. **Check that all drives are mounted**
5. **Use dry-run to preview operations**

### During Operations

1. **Don't modify files** being processed
2. **Don't unmount drives** until complete
3. **Keep system awake** (disable sleep/hibernation)
4. **Monitor progress** with --verbose for large operations

### After Operations

1. **Verify results** (check exit code, read summary)
2. **Test recovery** before assuming backups work
3. **Keep digests updated** when files change
4. **Store digests safely** (they're critical for recovery)

### Regular Maintenance

1. **Update digests** regularly
2. **Verify integrity** periodically
3. **Test healing** occasionally
4. **Clean recycle bins** when safe
5. **Check mirror status** before relying on them

## Debug Mode

For deep troubleshooting, use verbose output:

```bash
file-sentinel command -i path::digest.db --verbose 2>&1 | tee debug.log
```

This saves all output to `debug.log` for review or sharing.

