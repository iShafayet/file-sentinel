#!/usr/bin/env bash

# Test Helpers for File Sentinel CLI Tests
# These functions provide common utilities for setting up and tearing down test fixtures

# Load .env.test if it exists (similar to npm tests)
load_test_env() {
  local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  local cli_tests_dir="$(cd "$script_dir/.." && pwd)"
  local env_file="$cli_tests_dir/.env.test"
  
  if [[ -f "$env_file" ]]; then
    # Source the .env.test file, handling comments and empty lines
    while IFS= read -r line || [[ -n "$line" ]]; do
      # Skip comments and empty lines
      [[ "$line" =~ ^[[:space:]]*# ]] && continue
      [[ -z "${line// }" ]] && continue
      
      # Export the variable
      if [[ "$line" =~ ^[[:space:]]*([A-Z_]+)=(.*)$ ]]; then
        local key="${BASH_REMATCH[1]}"
        local value="${BASH_REMATCH[2]}"
        # Remove quotes if present
        value="${value#\"}"
        value="${value%\"}"
        value="${value#\'}"
        value="${value%\'}"
        export "$key=$value"
      fi
    done < "$env_file"
  fi
}

# Initialize test environment
load_test_env

# Get the base directory for temporary test files
get_test_temp_base() {
  # Priority: TEST_TEMP_BASE_DIR env var > TMPDIR > /tmp
  if [[ -n "$TEST_TEMP_BASE_DIR" ]]; then
    echo "$TEST_TEMP_BASE_DIR"
  elif [[ -n "$TMPDIR" ]]; then
    echo "$TMPDIR"
  else
    echo "/tmp"
  fi
}

# Create a temporary test directory
create_test_dir() {
  local test_name="$1"
  local base_dir=$(get_test_temp_base)
  local test_dir="${base_dir}/file-sentinel-test-${test_name}-$$-${RANDOM}"
  mkdir -p "$test_dir"
  echo "$test_dir"
}

# Clean up test directory
cleanup_test_dir() {
  local test_dir="$1"
  
  # Only clean up if KEEP_TEST_DIRS is not set to 'true'
  if [[ "${KEEP_TEST_DIRS:-false}" == "true" ]]; then
    echo "Keeping test directory (KEEP_TEST_DIRS=true): $test_dir" >&2
    return 0
  fi
  
  # Safety check: only delete directories that match our pattern
  # Pattern: */file-sentinel-test-*
  if [[ -n "$test_dir" && "$test_dir" =~ /file-sentinel-test- ]]; then
    rm -rf "$test_dir" 2>/dev/null || true
  fi
}

# Create a test file with specific content
create_test_file() {
  local filepath="$1"
  local content="$2"
  local dir=$(dirname "$filepath")
  mkdir -p "$dir"
  echo "$content" > "$filepath"
}

# Try to create a file with a risky character
# Returns 0 if successful, non-zero if filesystem doesn't support the character
try_create_risky_file() {
  local filepath="$1"
  local content="$2"
  local dir=$(dirname "$filepath")
  mkdir -p "$dir"
  
  # Try to create the file - redirect stderr to avoid noise
  if echo "$content" > "$filepath" 2>/dev/null; then
    # Verify it was actually created (some filesystems may silently fail)
    if [[ -f "$filepath" ]]; then
      return 0
    fi
  fi
  return 1
}

# Check if filesystem supports creating files with risky characters
# Returns 0 if supported, non-zero if not
filesystem_supports_risky_chars() {
  local test_dir="$1"
  local test_file="${test_dir}/.test_risky_char_$$"
  
  # Try to create a file with colon (common problematic character)
  if try_create_risky_file "${test_file}:test" "test" 2>/dev/null; then
    rm -f "${test_file}:test" 2>/dev/null || true
    return 0
  fi
  
  return 1
}

# Create a test file with random content of specified size
create_random_file() {
  local filepath="$1"
  local size_kb="$2"
  local dir=$(dirname "$filepath")
  mkdir -p "$dir"
  dd if=/dev/urandom of="$filepath" bs=1024 count="$size_kb" 2>/dev/null
}

# Create a directory structure with multiple files
create_test_structure() {
  local base_dir="$1"
  
  # Create subdirectories
  mkdir -p "$base_dir/photos/2024"
  mkdir -p "$base_dir/photos/2023"
  mkdir -p "$base_dir/documents"
  mkdir -p "$base_dir/videos"
  
  # Create test files
  create_test_file "$base_dir/README.txt" "This is a test directory"
  create_test_file "$base_dir/photos/2024/photo1.jpg" "fake photo 1 data"
  create_test_file "$base_dir/photos/2024/photo2.jpg" "fake photo 2 data"
  create_test_file "$base_dir/photos/2023/photo3.jpg" "fake photo 3 data"
  create_test_file "$base_dir/documents/report.pdf" "fake pdf data"
  create_test_file "$base_dir/documents/notes.txt" "test notes"
  create_test_file "$base_dir/videos/video1.mp4" "fake video data"
}

# Get the SHA256 hash of a file (cross-platform)
get_file_hash() {
  local filepath="$1"
  if command -v sha256sum &> /dev/null; then
    sha256sum "$filepath" | awk '{print $1}'
  elif command -v shasum &> /dev/null; then
    shasum -a 256 "$filepath" | awk '{print $1}'
  else
    echo "ERROR: No SHA256 utility found" >&2
    return 1
  fi
}

# Check if file-sentinel CLI is available
check_cli_available() {
  if ! command -v file-sentinel &> /dev/null; then
    echo "ERROR: file-sentinel CLI not found in PATH" >&2
    echo "Please run 'npm run install-cli' from the project root" >&2
    return 1
  fi
  return 0
}

# Wait for a file to exist (with timeout)
wait_for_file() {
  local filepath="$1"
  local timeout="${2:-10}"
  local elapsed=0
  
  while [[ ! -f "$filepath" && $elapsed -lt $timeout ]]; do
    sleep 0.5
    elapsed=$((elapsed + 1))
  done
  
  [[ -f "$filepath" ]]
}

# Count files in a directory (excluding hidden files)
count_files() {
  local dir="$1"
  find "$dir" -type f ! -path '*/.*' | wc -l | tr -d ' '
}

# Check if digest database exists and is valid SQLite
is_valid_digest() {
  local digest_file="$1"
  
  if [[ ! -f "$digest_file" ]]; then
    return 1
  fi
  
  # Check if it's a valid SQLite database
  if command -v sqlite3 &> /dev/null; then
    sqlite3 "$digest_file" "SELECT name FROM sqlite_master WHERE type='table';" &> /dev/null
    return $?
  fi
  
  # If sqlite3 not available, just check if file exists and has size > 0
  [[ -s "$digest_file" ]]
}

# Get file count from digest database
get_digest_file_count() {
  local digest_file="$1"
  
  if ! command -v sqlite3 &> /dev/null; then
    echo "0"
    return
  fi
  
  sqlite3 "$digest_file" "SELECT COUNT(*) FROM files;" 2>/dev/null || echo "0"
}

# Corrupt a file by modifying its content
corrupt_file() {
  local filepath="$1"
  echo "CORRUPTED" >> "$filepath"
}

# Create a mirror copy of a directory
create_mirror() {
  local source_dir="$1"
  local mirror_dir="$2"
  
  mkdir -p "$mirror_dir"
  cp -r "$source_dir"/* "$mirror_dir"/ 2>/dev/null || true
}

# Assert file exists
assert_file_exists() {
  local filepath="$1"
  local message="${2:-File should exist: $filepath}"
  
  if [[ ! -f "$filepath" ]]; then
    echo "ASSERTION FAILED: $message" >&2
    return 1
  fi
  return 0
}

# Assert file does not exist
assert_file_not_exists() {
  local filepath="$1"
  local message="${2:-File should not exist: $filepath}"
  
  if [[ -f "$filepath" ]]; then
    echo "ASSERTION FAILED: $message" >&2
    return 1
  fi
  return 0
}

# Assert directory exists
assert_dir_exists() {
  local dirpath="$1"
  local message="${2:-Directory should exist: $dirpath}"
  
  if [[ ! -d "$dirpath" ]]; then
    echo "ASSERTION FAILED: $message" >&2
    return 1
  fi
  return 0
}

# Assert string contains substring
assert_output_contains() {
  local output="$1"
  local expected="$2"
  local message="${3:-Output should contain: $expected}"
  
  if [[ ! "$output" =~ $expected ]]; then
    echo "ASSERTION FAILED: $message" >&2
    echo "Expected to find: $expected" >&2
    echo "In output: $output" >&2
    return 1
  fi
  return 0
}

# Setup function - called before each test
setup_test() {
  # Check CLI is available
  check_cli_available || exit 1
  
  # Create temp directory for this test
  export TEST_TEMP_DIR=$(create_test_dir "$(basename "$BATS_TEST_FILENAME" .bats)")
}

# Teardown function - called after each test
teardown_test() {
  # Clean up temp directory
  if [[ -n "$TEST_TEMP_DIR" ]]; then
    cleanup_test_dir "$TEST_TEMP_DIR"
  fi
}

# Export functions for use in BATS tests
export -f load_test_env
export -f get_test_temp_base
export -f create_test_dir
export -f cleanup_test_dir
export -f create_test_file
export -f try_create_risky_file
export -f filesystem_supports_risky_chars
export -f create_random_file
export -f create_test_structure
export -f get_file_hash
export -f check_cli_available
export -f wait_for_file
export -f count_files
export -f is_valid_digest
export -f get_digest_file_count
export -f corrupt_file
export -f create_mirror
export -f assert_file_exists
export -f assert_file_not_exists
export -f assert_dir_exists
export -f assert_output_contains
export -f setup_test
export -f teardown_test
