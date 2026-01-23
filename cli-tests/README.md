# File Sentinel CLI Integration Tests

This directory contains integration tests for the File Sentinel CLI. These tests invoke the CLI as an external process, testing the complete user experience without any programmatic access to internal APIs.

## Overview

The test suite is built using [BATS (Bash Automated Testing System)](https://github.com/bats-core/bats-core), a TAP-compliant testing framework for Bash. BATS provides a simple, readable syntax for writing CLI tests.

### Why BATS?

- **Language-agnostic**: Tests the CLI contract, not the implementation
- **Reusable**: Same tests can validate different implementations (Node.js, Rust, etc.)
- **True integration**: Tests what users actually experience
- **Simple**: Easy to read and write, even for non-developers

## Prerequisites

### Required

- **Node.js 18.0.0+**: For installing BATS via npm
- **file-sentinel CLI**: Must be installed and available in PATH

### Optional

- **sqlite3**: For advanced digest inspection (tests work without it)

## Installation

1. Install dependencies:

```bash
cd cli-tests
npm install
```

2. Install the file-sentinel CLI globally:

```bash
cd ..
npm run install-cli
```

3. Verify installation:

```bash
file-sentinel --help
```

## Configuration

Test behavior can be configured using a `.env.test` file (similar to the npm tests).

### Setup Configuration

1. Copy the example file:

```bash
cd cli-tests
cp .env.test.example .env.test
```

2. Edit `.env.test` to customize:

```bash
# Base directory for temporary test files
# Default: /tmp (or $TMPDIR if set)
TEST_TEMP_BASE_DIR=./.local/cli-test-temp

# Whether to keep test directories after tests complete (for debugging)
# Set to 'true' to keep temp directories, 'false' to clean up automatically
KEEP_TEST_DIRS=false
```

### Configuration Options

#### `TEST_TEMP_BASE_DIR`

Base directory where temporary test files are created.

- **Default**: `/tmp` (or `$TMPDIR` if set)
- **Examples**:
  - `TEST_TEMP_BASE_DIR=/tmp` - Use system temp directory
  - `TEST_TEMP_BASE_DIR=./.local/cli-test-temp` - Use local directory
  - `TEST_TEMP_BASE_DIR=$HOME/.cache/file-sentinel-tests` - Use cache directory

**Note**: The actual test directories are created as subdirectories with unique names like:
```
${TEST_TEMP_BASE_DIR}/file-sentinel-test-{test-name}-{pid}-{random}
```

#### `KEEP_TEST_DIRS`

Whether to keep test directories after tests complete (useful for debugging).

- **Default**: `false` (directories are cleaned up automatically)
- **Set to `true`**: Keep directories for inspection after test failures

### Environment Variables

You can also set these via environment variables instead of `.env.test`:

```bash
export TEST_TEMP_BASE_DIR=./.local/cli-test-temp
export KEEP_TEST_DIRS=true
npm test
```

Environment variables take precedence over `.env.test` values.

## Running Tests

### Run all tests

```bash
cd cli-tests
npm test
```

### Run specific test suite

```bash
npm run test:digest      # Test digest command
npm run test:verify      # Test verify command
npm run test:replicate   # Test replicate command
npm run test:heal        # Test heal command
npm run test:compare     # Test compare command
```

### Run tests directly with BATS

```bash
npx bats test-digest.bats
npx bats test-verify.bats --verbose
```

## Test Structure

```
cli-tests/
├── package.json              # npm dependencies (BATS)
├── README.md                 # This file
├── .env.test.example         # Example configuration file
├── .env.test                 # Your configuration (create from example)
├── helpers/
│   └── test-helpers.bash     # Shared test utilities
├── test-digest.bats          # Tests for digest command
├── test-verify.bats          # Tests for verify command
├── test-replicate.bats       # Tests for replicate command
├── test-heal.bats            # Tests for heal command
└── test-compare.bats         # Tests for compare command
```

## Test Coverage

### digest command (test-digest.bats)

- Creates new digest databases
- Updates existing digests
- Handles subdirectory filtering
- Detects added, modified, and deleted files
- Supports dry-run mode
- Handles various directory structures

### verify command (test-verify.bats)

- Verifies files against digests
- Detects corrupted files
- Detects missing files
- Detects extra files
- Handles subdirectory filtering
- Supports verbose output

### replicate command (test-replicate.bats)

- Copies files to destination
- Creates destination digests
- Performs incremental sync
- Handles file deletions (recycle bin)
- Supports permanent deletion
- Uses mirrors as fallback
- Handles subdirectory filtering

### heal command (test-heal.bats)

- Restores corrupted files from mirrors
- Restores missing files from mirrors
- Tries multiple mirrors in order
- Leaves valid files unchanged
- Handles subdirectory filtering
- Reports recovery failures

### compare command (test-compare.bats)

- Compares two digests
- Detects new, changed, and deleted files
- Shows summary of differences
- Is read-only (doesn't modify digests)
- Predicts replicate operations
- Handles verbose output

## Writing Tests

### Basic test structure

```bash
#!/usr/bin/env bats

load helpers/test-helpers

setup() {
  setup_test  # Creates TEST_TEMP_DIR
}

teardown() {
  teardown_test  # Cleans up TEST_TEMP_DIR
}

@test "description of what is being tested" {
  # Arrange
  local test_dir="$TEST_TEMP_DIR/source"
  create_test_file "$test_dir/test.txt" "content"
  
  # Act
  run file-sentinel digest -i "$test_dir::$test_dir/digest.db" --no-tty
  
  # Assert
  [ "$status" -eq 0 ]
  assert_file_exists "$test_dir/digest.db"
}
```

### Available helper functions

See `helpers/test-helpers.bash` for all available functions:

- `create_test_dir()` - Create temporary test directory
- `create_test_file()` - Create file with content
- `create_test_structure()` - Create standard test directory structure
- `corrupt_file()` - Corrupt a file for testing
- `create_mirror()` - Create mirror copy of directory
- `assert_file_exists()` - Assert file exists
- `get_file_hash()` - Get SHA256 hash of file
- `is_valid_digest()` - Check if digest is valid SQLite DB
- And many more...

### Best practices

1. **Always use `--no-tty` flag**: Disables progress bars and colors for clean output
2. **Use `$TEST_TEMP_DIR`**: Automatically cleaned up after each test
3. **Test exit codes**: Use `[ "$status" -eq 0 ]` for success, `[ "$status" -ne 0 ]` for failure
4. **Test output**: Use `[[ "$output" =~ "pattern" ]]` to check output contains expected text
5. **Isolate tests**: Each test should be independent and not rely on other tests

## Platform Support

### Linux / macOS

Tests run natively with bash.

```bash
npm test
```

### Windows

Tests require one of the following:

1. **WSL (Windows Subsystem for Linux)** - Recommended
   ```bash
   # In WSL terminal
   cd /mnt/c/path/to/file-sentinel/cli-tests
   npm test
   ```

2. **Git Bash / MSYS2** - May work but not officially supported
3. **Cygwin** - May work but not officially supported

## Continuous Integration

These tests are designed to run in CI/CD environments:

```yaml
# Example GitHub Actions workflow
- name: Install CLI
  run: npm run install-cli

- name: Run CLI tests
  run: |
    cd cli-tests
    npm install
    npm test
```

## Troubleshooting

### CLI not found

```
ERROR: file-sentinel CLI not found in PATH
```

**Solution**: Install the CLI globally:
```bash
cd ..
npm run install-cli
```

### Permission denied

```
Permission denied: /tmp/file-sentinel-test-*
```

**Solution**: Configure a different temp directory:

1. **Using .env.test** (recommended):
   ```bash
   # In cli-tests/.env.test
   TEST_TEMP_BASE_DIR=./.local/cli-test-temp
   ```

2. **Using environment variable**:
   ```bash
   export TEST_TEMP_BASE_DIR=./.local/cli-test-temp
   npm test
   ```

3. **Using TMPDIR**:
   ```bash
   export TMPDIR=/path/to/writable/tmp
   npm test
   ```

### Tests fail on Windows

**Solution**: Use WSL (Windows Subsystem for Linux):
```bash
# Install WSL if not already installed
wsl --install

# Run tests in WSL
wsl
cd /mnt/c/path/to/file-sentinel/cli-tests
npm test
```

### SQLite not found warnings

Some helper functions use `sqlite3` for advanced digest inspection. Tests will still pass without it, but you may see warnings.

**Solution** (optional):
```bash
# Ubuntu/Debian
sudo apt-get install sqlite3

# macOS
brew install sqlite3

# Fedora
sudo dnf install sqlite
```

## Future Plans

When File Sentinel is rewritten in Rust (or any other language), these same tests can be used to validate the new implementation:

1. Build the new CLI
2. Install it (make it available as `file-sentinel` in PATH)
3. Run the same test suite: `npm test`
4. All tests should pass if the CLI contract is maintained

This ensures backward compatibility and prevents regressions during rewrites.

## Contributing

When adding new CLI features:

1. Add corresponding tests in the appropriate test file
2. Use descriptive test names: `@test "command: what it should do"`
3. Test both success and failure cases
4. Test edge cases (empty directories, large files, etc.)
5. Ensure tests are isolated and don't depend on each other

## License

These tests are part of the File Sentinel project and are licensed under GPL-3.0.
