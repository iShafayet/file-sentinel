# Getting Started with File Sentinel

This guide will help you install File Sentinel and create your first digest.

## Installation

### Prerequisites

File Sentinel requires Node.js version 18.0.0 or higher. Check your Node.js version:

```bash
node --version
```

If you need to install or upgrade Node.js, visit [nodejs.org](https://nodejs.org/).

### Installing File Sentinel

#### Option 1: Install from npm (Recommended)

Install File Sentinel globally from npm to use it anywhere on your system:

```bash
npm install -g file-sentinel
```

After installation, verify it works:

```bash
file-sentinel --help
```

You should see the help text with available commands.

#### Option 2: Install from Source

If you want to contribute or customize File Sentinel, you can install from source:

```bash
git clone https://github.com/iShafayet/file-sentinel.git
cd file-sentinel
npm install
npm run build
npm run install-cli
```

## Understanding the Basics

### What is a Digest?

A digest is a SQLite database file that stores:

- SHA-256 hashes of all files in a directory
- File sizes and modification times
- Operation history and statistics

Think of it as a detailed inventory of your files with their unique "fingerprints."

### Path Format

File Sentinel uses a special format to specify directories and their digests:

```
/path/to/directory::/path/to/digest.db
```

The `::` (double colon) separates the directory path from the digest file path. This works on all operating systems, including Windows:

```
C:\Users\YourName\Documents::C:\Users\YourName\documents-digest.db
```

## Creating Your First Digest

Let's create a digest for a directory called "Documents":

### Step 1: Choose Your Directory

Decide which directory you want to monitor. For this example, we'll use `~/Documents`.

### Step 2: Run the Digest Command

```bash
file-sentinel digest -i ~/Documents::~/Documents/digest.db
```

This command:

- Scans all files in `~/Documents`
- Calculates SHA-256 hashes for each file
- Stores the information in `digest.db`

### Step 3: Wait for Completion

Depending on the size and number of files, this may take from seconds to hours. You'll see output like:

```
Starting Digest Operation
Input Directory: /home/user/Documents
Digest File: /home/user/Documents/digest.db
Discovered 1,523 files
Processing files...
DIGEST Operation COMPLETED
Files Added: 1,523
Execution Time: 00:02:34
```

### Step 4: Verify the Digest

You can verify your files against the digest immediately:

```bash
file-sentinel verify -i ~/Documents::~/Documents/digest.db
```

If everything is correct, you'll see:

```
VERIFY Operation COMPLETED
Files Verified: 1,523
Files Failed: 0
```

## Understanding the Output

### Digest Command Output

When you create or update a digest, you'll see:

- **Files Added** - New files that weren't in the digest before
- **Files Updated** - Files that changed since last digest
- **Files Unchanged** - Files that haven't changed
- **Files Deleted** - Entries removed (files no longer exist)

### Verify Command Output

When verifying files, you'll see:

- **Files Verified** - Files that match their stored hash
- **Files Failed** - Files with hash mismatches (potential corruption)
- **Files Missing** - Files in digest but not on disk
- **Files Extra** - Files on disk but not in digest

## Common Options

All commands support these options:

### --verbose

Show detailed information about each file being processed:

```bash
file-sentinel digest -i ~/Documents::~/digest.db --verbose
```

### --dry-run

Simulate the operation without making any changes:

```bash
file-sentinel digest -i ~/Documents::~/digest.db --dry-run
```

### --panic-on-error

Stop immediately if any error occurs (default is to continue):

```bash
file-sentinel verify -i ~/Documents::~/digest.db --panic-on-error
```

## What's Next?

Now that you've created your first digest, you can:

1. [Learn about all available commands](command-reference.md)
2. [Set up automated backups](workflows.md#basic-backup-workflow)
3. [Configure mirrors for file recovery](workflows.md#setting-up-mirrors)

## Tips for Beginners

### Where to Store Digests

**Good locations:**

- Same disk as your files (easy to keep together)
- A dedicated backup directory (organized separately)
- On a different drive (added protection)

**Avoid:**

- Inside subdirectories you're monitoring (can cause confusion)
- Network drives with poor connection (can be slow)

### How Often to Update Digests

- **Critical data**: After every significant change
- **Work files**: Daily or weekly
- **Archived data**: Once, then verify periodically
- **Media collections**: After adding new content

### Starting Small

If you're new to File Sentinel:

1. Start with a small directory (less than 10 GB)
2. Practice the digest and verify commands
3. Experiment with dry-run mode
4. Gradually expand to larger directories

## Troubleshooting

### "Command not found"

If you get a "command not found" error, the installation may not have completed properly. Try:

```bash
npm install -g file-sentinel --force
```

### Permission Errors

If you get permission errors:

- On Linux/macOS: You may need to use `sudo` or fix npm permissions
- On Windows: Run your terminal as Administrator

### Slow Performance

Digesting many files or large files takes time. This is normal. Use `--verbose` to see progress.

For more help, see the [Troubleshooting Guide](troubleshooting.md).
