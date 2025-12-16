# File Sentinel Documentation

Welcome to the File Sentinel documentation. File Sentinel is a command-line tool for monitoring file integrity, creating backups, and recovering corrupted files.

## Table of Contents

1. [Getting Started](getting-started.md) - Installation and basic setup
2. [Core Concepts](core-concepts.md) - Understanding digests and how File Sentinel works
3. [Command Reference](command-reference.md) - Complete guide to all commands
4. [Common Workflows](workflows.md) - Real-world usage examples
5. [Troubleshooting](troubleshooting.md) - Solutions to common problems

## Quick Links

### For New Users
- [Installation Guide](getting-started.md#installation)
- [Your First Digest](getting-started.md#creating-your-first-digest)
- [Basic Workflow](workflows.md#basic-backup-workflow)

### For Advanced Users
- [Mirror Configuration](workflows.md#setting-up-mirrors)
- [Automated Healing](workflows.md#automated-healing-with-cron)
- [Performance Optimization](troubleshooting.md#performance-considerations)

## What Can File Sentinel Do?

File Sentinel helps you:

- **Monitor file integrity** - Detect when files have been corrupted or modified
- **Create backups** - Replicate directories with integrity verification
- **Recover files** - Automatically restore corrupted files from backup copies
- **Track changes** - Maintain a database of file hashes for verification

## How It Works

File Sentinel creates a "digest" - a database containing cryptographic hashes of your files. This digest can then be used to verify that files haven't been corrupted, replicate them to backup locations, or recover damaged files from mirrors (backup copies).

## System Requirements

- **Operating System**: Linux, macOS, or Windows
- **Node.js**: Version 18.0.0 or higher
- **Disk Space**: Minimal (digest databases are typically small)
- **Command Line**: Basic familiarity recommended

## Getting Help

If you encounter issues or have questions:

1. Check the [Troubleshooting Guide](troubleshooting.md)
2. Review the [Command Reference](command-reference.md) for detailed options
3. Open an issue on the project repository

## License

File Sentinel is licensed under GPL-3.0. See the LICENSE file for details.

