# File Sentinel

[![npm version](https://img.shields.io/npm/v/file-sentinel.svg)](https://www.npmjs.com/package/file-sentinel)
[![npm downloads](https://img.shields.io/npm/dm/file-sentinel.svg)](https://www.npmjs.com/package/file-sentinel)
[![license](https://img.shields.io/npm/l/file-sentinel.svg)](https://github.com/iShafayet/file-sentinel/blob/main/LICENSE)
[![Node.js version](https://img.shields.io/node/v/file-sentinel.svg)](https://nodejs.org)

A command-line tool for monitoring file integrity, creating verified backups, and recovering corrupted files using cryptographic hashing.

## Overview

File Sentinel helps you protect your data by:

- **Detecting corruption** - Verify files haven't been modified or damaged using SHA-256 hashes
- **Creating backups** - Replicate directories with automatic integrity verification
- **Recovering files** - Automatically restore corrupted files from backup copies (mirrors)
- **Tracking changes** - Maintain a database (digest) of file states over time

## Quick Start

### Installation

Install globally using npm:

```bash
npm install -g file-sentinel
```

Verify installation:

```bash
file-sentinel --help
```

### Basic Usage

**Create a digest** (inventory of your files):

```bash
file-sentinel digest -i ~/Documents::~/Documents/digest.db
```

**Verify integrity**:

```bash
file-sentinel verify -i ~/Documents::~/Documents/digest.db
```

**Create a backup**:

```bash
file-sentinel replicate \
  -i ~/Documents::~/Documents/digest.db \
  -o /backup/Documents::/backup/Documents/digest.db
```

**Recover corrupted files**:

```bash
file-sentinel heal \
  -i ~/Documents::~/Documents/digest.db \
  --mirror /backup/Documents::/backup/Documents/digest.db
```

**Compare digests** (predict what replicate would do):

```bash
file-sentinel compare \
  --local ~/Documents/digest.db \
  --remote /backup/Documents/digest.db
```

## Core Commands

File Sentinel provides five main commands:

- **digest** - Create or update a file inventory with cryptographic hashes
- **verify** - Check files against their recorded state to detect corruption
- **replicate** - Copy files to another location with integrity verification
- **heal** - Restore corrupted or missing files from backup mirrors
- **compare** - Compare two digests to predict what a replicate operation would do

## Key Features

- **SQLite-based digests** - Fast, reliable database for storing file metadata
- **SHA-256 hashing** - Industry-standard cryptographic verification
- **Mirror support** - Multiple backup locations for redundancy
- **Recycle bin** - Soft deletion with recovery option
- **Subdirectory filtering** - Process only specific folders
- **Progress reporting** - Real-time feedback with progress bars and spinners
- **Cross-platform** - Works on Linux, macOS, and Windows
- **Dry-run mode** - Preview changes before execution
- **Automation-friendly** - Clean output for scripts and CI/CD with `--no-tty`

## Documentation

Complete documentation is available in the `docs/` directory:

- [Getting Started Guide](docs/getting-started.md) - Installation and first steps
- [Core Concepts](docs/core-concepts.md) - Understanding digests, hashes, and mirrors
- [Command Reference](docs/command-reference.md) - Detailed command documentation
- [Common Workflows](docs/workflows.md) - Real-world usage examples
- [Troubleshooting](docs/troubleshooting.md) - Solutions to common problems

## Requirements

- Node.js 18.0.0 or higher
- Operating System: Linux, macOS, or Windows
- Basic command-line familiarity

## Development

### Setup

Clone and install dependencies:

```bash
git clone https://github.com/iShafayet/file-sentinel.git
cd file-sentinel
npm install
```

### Build

Compile TypeScript to JavaScript:

```bash
npm run build
```

### Run Locally

Execute the compiled version:

```bash
npm run start-compiled
```

Or run directly with ts-node:

```bash
node dist/src/start.js <command> [options]
```

### Install as CLI Tool

Install the built version as a global command:

```bash
npm run install-cli
```

### Testing

Run the integration test suite:

```bash
npm test
```

## Example Workflow

Here's a complete workflow for protecting important documents:

```bash
# 1. Create initial digest
file-sentinel digest -i ~/Documents::~/Documents/digest.db

# 2. Create a backup
file-sentinel replicate \
  -i ~/Documents::~/Documents/digest.db \
  -o /backup/Documents::/backup/Documents/digest.db

# 3. Verify integrity periodically
file-sentinel verify -i ~/Documents::~/Documents/digest.db

# 4. If corruption is detected, heal from backup
file-sentinel heal \
  -i ~/Documents::~/Documents/digest.db \
  --mirror /backup/Documents::/backup/Documents/digest.db

# 5. After making changes, update digest
file-sentinel digest -i ~/Documents::~/Documents/digest.db

# 6. Preview what would be synced (optional)
file-sentinel compare \
  --local ~/Documents/digest.db \
  --remote /backup/Documents/digest.db

# 7. Sync changes to backup
file-sentinel replicate \
  -i ~/Documents::~/Documents/digest.db \
  -o /backup/Documents::/backup/Documents/digest.db
```

## Use Cases

File Sentinel is useful for:

- Protecting important documents and files from corruption
- Creating and maintaining verified backups
- Detecting silent data corruption (bit rot)
- Archiving photos, videos, and media collections
- Maintaining data integrity for work files
- Synchronizing directories across multiple locations
- Recovering from hardware failures or accidental modifications

## Path Format

File Sentinel uses a special format to specify directories and their digest files:

```
/path/to/directory::/path/to/digest.db
```

The double colon (`::`) separates the directory from its digest file. This works on all platforms, including Windows:

```
C:\Users\YourName\Documents::C:\Users\YourName\digest.db
```

## Links

- **npm Package**: [npmjs.com/package/file-sentinel](https://www.npmjs.com/package/file-sentinel)
- **GitHub Repository**: [github.com/iShafayet/file-sentinel](https://github.com/iShafayet/file-sentinel)
- **Documentation**: See the `docs/` directory

## Support

For issues, questions, or contributions:

- Read the [Troubleshooting Guide](docs/troubleshooting.md)
- Check the [Command Reference](docs/command-reference.md)
- Open an issue on [GitHub](https://github.com/iShafayet/file-sentinel/issues)

## License

File Sentinel is licensed under the GNU General Public License v3.0. See [LICENSE](LICENSE) for details.

## Author

2025 © [Sayem Shafayet](https://sayemshafayet.com)
