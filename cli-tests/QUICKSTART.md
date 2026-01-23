# CLI Tests Quick Start

Get up and running with File Sentinel CLI tests in 3 steps.

## Step 1: Install the CLI

From the project root:

```bash
npm run install-cli
```

This builds the project and installs `file-sentinel` globally.

## Step 2: Install Test Dependencies

```bash
cd cli-tests
npm install
```

This installs BATS (the test framework).

## Step 3: (Optional) Configure Test Settings

If you want to customize where temporary test files are created:

```bash
cp .env.test.example .env.test
# Edit .env.test to set TEST_TEMP_BASE_DIR
```

By default, tests use `/tmp` (or `$TMPDIR` if set). See [Configuration](#configuration) below for details.

## Step 4: Run Tests

### Run all tests

```bash
npm test
```

Or use the test runner script:

```bash
./run-all-tests.sh
```

### Run specific test suite

```bash
npm run test:digest      # Test digest command
npm run test:verify      # Test verify command
npm run test:replicate   # Test replicate command
npm run test:heal        # Test heal command
npm run test:compare     # Test compare command
```

### Run from project root

```bash
cd ..
npm run test:cli
```

## What Gets Tested?

Each test suite invokes the `file-sentinel` CLI as an external process and validates:

- ✅ Exit codes (0 for success, non-zero for errors)
- ✅ Output messages and formatting
- ✅ File operations (creation, modification, deletion)
- ✅ Database operations (digest creation and updates)
- ✅ Error handling and edge cases

## Example Test Output

```
 ✓ digest: creates new digest database
 ✓ digest: processes all files in directory
 ✓ digest: updates existing digest
 ✓ digest: handles subdirectory option
 ✓ digest: --verbose shows detailed output
 ✓ digest: --dry-run does not create digest file

6 tests, 0 failures
```

## Troubleshooting

### "file-sentinel CLI not found"

Make sure you've installed the CLI:

```bash
cd ..
npm run install-cli
```

Verify it's in your PATH:

```bash
which file-sentinel
file-sentinel --version
```

### Tests fail on Windows

Use WSL (Windows Subsystem for Linux):

```bash
wsl
cd /mnt/c/path/to/file-sentinel/cli-tests
npm test
```

### Permission denied errors

If you get permission errors when creating temp files, configure a different directory:

```bash
# Create .env.test
cp .env.test.example .env.test

# Edit .env.test and set:
TEST_TEMP_BASE_DIR=./.local/cli-test-temp
```

Or use an environment variable:

```bash
export TEST_TEMP_BASE_DIR=./.local/cli-test-temp
npm test
```

## Configuration

Test behavior can be configured via `.env.test` file (similar to npm tests):

- **`TEST_TEMP_BASE_DIR`**: Where temporary test files are created (default: `/tmp`)
- **`KEEP_TEST_DIRS`**: Keep test directories after completion for debugging (default: `false`)

See [README.md](README.md#configuration) for full details.

### Need more details?

See the full [README.md](README.md) for comprehensive documentation.

## Next Steps

- Read [README.md](README.md) for detailed documentation
- Check [helpers/test-helpers.bash](helpers/test-helpers.bash) for available test utilities
- Look at existing test files to understand the patterns
- Add your own tests when adding new CLI features

## Running Both Test Suites

To run both unit tests (Jest) and CLI tests (BATS):

```bash
cd ..
npm run test:all
```

This runs:
1. Unit tests in `test/` directory (Jest)
2. CLI integration tests in `cli-tests/` directory (BATS)
