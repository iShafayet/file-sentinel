#!/usr/bin/env bats

# Test suite for 'file-sentinel digest' command

load helpers/test-helpers

setup() {
  setup_test
}

teardown() {
  teardown_test
}

@test "digest: --help shows usage information" {
  run file-sentinel digest --help
  [ "$status" -eq 0 ]
  [[ "$output" =~ "Create or update digest" ]]
  [[ "$output" =~ "-i, --input" ]]
  [[ "$output" =~ "compatibility-risk-strategy" ]]
}

@test "digest: creates new digest database" {
  local test_dir="$TEST_TEMP_DIR/source"
  local digest_file="$TEST_TEMP_DIR/digest.db"
  
  create_test_structure "$test_dir"
  
  run file-sentinel digest -i "$test_dir::$digest_file" --no-tty
  echo "Output: $output"
  [ "$status" -eq 0 ]
  
  # Check digest file was created
  assert_file_exists "$digest_file"
  
  # Verify it's a valid SQLite database
  is_valid_digest "$digest_file"
}

@test "digest: processes all files in directory" {
  local test_dir="$TEST_TEMP_DIR/source"
  local digest_file="$TEST_TEMP_DIR/digest.db"
  
  create_test_structure "$test_dir"
  
  run file-sentinel digest -i "$test_dir::$digest_file" --no-tty
  [ "$status" -eq 0 ]
  
  # Count files in directory
  local file_count=$(count_files "$test_dir")
  
  # Get file count from digest
  local digest_count=$(get_digest_file_count "$digest_file")
  
  # They should match
  [ "$file_count" -eq "$digest_count" ]
}

@test "digest: updates existing digest" {
  local test_dir="$TEST_TEMP_DIR/source"
  local digest_file="$TEST_TEMP_DIR/digest.db"
  
  create_test_structure "$test_dir"
  
  # Create initial digest
  run file-sentinel digest -i "$test_dir::$digest_file" --no-tty
  [ "$status" -eq 0 ]
  
  # Add a new file
  create_test_file "$test_dir/newfile.txt" "new content"
  
  # Update digest
  run file-sentinel digest -i "$test_dir::$digest_file" --no-tty
  [ "$status" -eq 0 ]
  [[ "$output" =~ "Files Added: 1" ]] || [[ "$output" =~ "added" ]]
}

@test "digest: handles subdirectory option" {
  local test_dir="$TEST_TEMP_DIR/source"
  local digest_file="$TEST_TEMP_DIR/digest.db"
  
  create_test_structure "$test_dir"
  
  # Digest only photos subdirectory
  run file-sentinel digest -i "$test_dir::$digest_file" -s photos --no-tty
  [ "$status" -eq 0 ]
  
  # Count files in photos subdirectory
  local photos_count=$(find "$test_dir/photos" -type f | wc -l | tr -d ' ')
  
  # Get file count from digest
  local digest_count=$(get_digest_file_count "$digest_file")
  
  # They should match
  [ "$photos_count" -eq "$digest_count" ]
}

@test "digest: --verbose shows detailed output" {
  local test_dir="$TEST_TEMP_DIR/source"
  local digest_file="$TEST_TEMP_DIR/digest.db"
  
  create_test_file "$test_dir/test.txt" "test content"
  
  run file-sentinel digest -i "$test_dir::$digest_file" --verbose --no-tty
  [ "$status" -eq 0 ]
  
  # Verbose output should contain more details
  [[ "$output" =~ "test.txt" ]] || [[ "$output" =~ "Processing" ]]
}

@test "digest: --dry-run does not create digest file" {
  local test_dir="$TEST_TEMP_DIR/source"
  local digest_file="$TEST_TEMP_DIR/digest.db"
  
  create_test_structure "$test_dir"
  
  run file-sentinel digest -i "$test_dir::$digest_file" --dry-run --no-tty
  [ "$status" -eq 0 ]
  
  # Digest file should NOT be created in dry-run mode
  assert_file_not_exists "$digest_file"
}

@test "digest: fails with invalid directory" {
  local test_dir="$TEST_TEMP_DIR/nonexistent"
  local digest_file="$TEST_TEMP_DIR/digest.db"
  
  run file-sentinel digest -i "$test_dir::$digest_file" --no-tty
  [ "$status" -ne 0 ]
}

@test "digest: handles empty directory" {
  local test_dir="$TEST_TEMP_DIR/empty"
  local digest_file="$TEST_TEMP_DIR/digest.db"
  
  mkdir -p "$test_dir"
  
  run file-sentinel digest -i "$test_dir::$digest_file" --no-tty
  [ "$status" -eq 0 ]
  
  # Digest should be created even for empty directory
  assert_file_exists "$digest_file"
  
  # Should have 0 files
  local digest_count=$(get_digest_file_count "$digest_file")
  [ "$digest_count" -eq 0 ]
}

@test "digest: detects deleted files" {
  local test_dir="$TEST_TEMP_DIR/source"
  local digest_file="$TEST_TEMP_DIR/digest.db"
  
  create_test_structure "$test_dir"
  
  # Create initial digest
  run file-sentinel digest -i "$test_dir::$digest_file" --no-tty
  [ "$status" -eq 0 ]
  
  local initial_count=$(get_digest_file_count "$digest_file")
  
  # Delete a file
  rm "$test_dir/README.txt"
  
  # Update digest
  run file-sentinel digest -i "$test_dir::$digest_file" --no-tty
  [ "$status" -eq 0 ]
  
  local final_count=$(get_digest_file_count "$digest_file")
  
  # Count should decrease by 1
  [ "$final_count" -eq $((initial_count - 1)) ]
}

@test "digest: handles large files" {
  local test_dir="$TEST_TEMP_DIR/source"
  local digest_file="$TEST_TEMP_DIR/digest.db"
  
  mkdir -p "$test_dir"
  
  # Create a 5MB file
  create_random_file "$test_dir/large.bin" 5120
  
  run file-sentinel digest -i "$test_dir::$digest_file" --no-tty
  [ "$status" -eq 0 ]
  
  assert_file_exists "$digest_file"
  
  local digest_count=$(get_digest_file_count "$digest_file")
  [ "$digest_count" -eq 1 ]
}

@test "digest: handles nested directories" {
  local test_dir="$TEST_TEMP_DIR/source"
  local digest_file="$TEST_TEMP_DIR/digest.db"
  
  # Create deeply nested structure
  mkdir -p "$test_dir/a/b/c/d/e"
  create_test_file "$test_dir/a/file1.txt" "content 1"
  create_test_file "$test_dir/a/b/file2.txt" "content 2"
  create_test_file "$test_dir/a/b/c/file3.txt" "content 3"
  create_test_file "$test_dir/a/b/c/d/file4.txt" "content 4"
  create_test_file "$test_dir/a/b/c/d/e/file5.txt" "content 5"
  
  run file-sentinel digest -i "$test_dir::$digest_file" --no-tty
  [ "$status" -eq 0 ]
  
  local digest_count=$(get_digest_file_count "$digest_file")
  [ "$digest_count" -eq 5 ]
}

@test "digest: --no-tty produces clean output" {
  local test_dir="$TEST_TEMP_DIR/source"
  local digest_file="$TEST_TEMP_DIR/digest.db"
  
  create_test_file "$test_dir/test.txt" "test"
  
  run file-sentinel digest -i "$test_dir::$digest_file" --no-tty
  [ "$status" -eq 0 ]
  
  # Output should not contain ANSI escape codes
  [[ ! "$output" =~ $'\033' ]]
}

@test "digest: exit code 0 on success" {
  local test_dir="$TEST_TEMP_DIR/source"
  local digest_file="$TEST_TEMP_DIR/digest.db"
  
  create_test_file "$test_dir/test.txt" "test"
  
  run file-sentinel digest -i "$test_dir::$digest_file" --no-tty
  [ "$status" -eq 0 ]
}

@test "digest: exit code non-zero on failure" {
  local test_dir="$TEST_TEMP_DIR/nonexistent"
  local digest_file="$TEST_TEMP_DIR/digest.db"
  
  run file-sentinel digest -i "$test_dir::$digest_file" --no-tty
  [ "$status" -ne 0 ]
}

@test "digest: --compatibility-risk-strategy=abort fails on risky filename" {
  local test_dir="$TEST_TEMP_DIR/source"
  local digest_file="$TEST_TEMP_DIR/digest.db"
  
  mkdir -p "$test_dir"
  
  # Skip if filesystem doesn't support risky characters
  if ! filesystem_supports_risky_chars "$test_dir"; then
    skip "Filesystem does not support creating files with risky characters"
  fi
  
  # Create file with problematic character (colon)
  try_create_risky_file "$test_dir/file:name.txt" "test content"
  
  run file-sentinel digest -i "$test_dir::$digest_file" --compatibility-risk-strategy=abort --no-tty
  [ "$status" -ne 0 ]
  [[ "$output" =~ "PROBLEMATIC FILENAME" ]] || [[ "$output" =~ "Problematic name" ]]
}

@test "digest: --compatibility-risk-strategy=skip skips risky filename" {
  local test_dir="$TEST_TEMP_DIR/source"
  local digest_file="$TEST_TEMP_DIR/digest.db"
  
  mkdir -p "$test_dir"
  
  # Skip if filesystem doesn't support risky characters
  if ! filesystem_supports_risky_chars "$test_dir"; then
    skip "Filesystem does not support creating files with risky characters"
  fi
  
  create_test_file "$test_dir/normal.txt" "normal content"
  try_create_risky_file "$test_dir/file:name.txt" "risky content"
  
  run file-sentinel digest -i "$test_dir::$digest_file" --compatibility-risk-strategy=skip --no-tty
  [ "$status" -eq 0 ]
  
  # Normal file should be in digest
  local digest_count=$(get_digest_file_count "$digest_file")
  [ "$digest_count" -eq 1 ]
  
  # Risky file should be skipped (not in digest)
  [[ "$output" =~ "Skipping risky name" ]] || [[ "$output" =~ "skipped" ]]
}

@test "digest: --compatibility-risk-strategy=accept-risk processes risky filename" {
  local test_dir="$TEST_TEMP_DIR/source"
  local digest_file="$TEST_TEMP_DIR/digest.db"
  
  mkdir -p "$test_dir"
  
  # Skip if filesystem doesn't support risky characters
  if ! filesystem_supports_risky_chars "$test_dir"; then
    skip "Filesystem does not support creating files with risky characters"
  fi
  
  try_create_risky_file "$test_dir/file:name.txt" "risky content"
  
  run file-sentinel digest -i "$test_dir::$digest_file" --compatibility-risk-strategy=accept-risk --no-tty
  [ "$status" -eq 0 ]
  
  # File should be in digest
  local digest_count=$(get_digest_file_count "$digest_file")
  [ "$digest_count" -eq 1 ]
  
  [[ "$output" =~ "Accepting risky name" ]] || [ "$status" -eq 0 ]
}

@test "digest: --compatibility-risk-strategy=mitigate-or-abort renames risky filename" {
  local test_dir="$TEST_TEMP_DIR/source"
  local digest_file="$TEST_TEMP_DIR/digest.db"
  
  mkdir -p "$test_dir"
  
  # Skip if filesystem doesn't support risky characters
  if ! filesystem_supports_risky_chars "$test_dir"; then
    skip "Filesystem does not support creating files with risky characters"
  fi
  
  try_create_risky_file "$test_dir/file:name.txt" "risky content"
  
  run file-sentinel digest -i "$test_dir::$digest_file" --compatibility-risk-strategy=mitigate-or-abort --no-tty
  [ "$status" -eq 0 ]
  
  # File should be renamed (colon replaced with !)
  assert_file_not_exists "$test_dir/file:name.txt"
  assert_file_exists "$test_dir/file!name.txt"
  
  # Renamed file should be in digest
  local digest_count=$(get_digest_file_count "$digest_file")
  [ "$digest_count" -eq 1 ]
}

@test "digest: --compatibility-risk-strategy=mitigate-or-skip renames or skips" {
  local test_dir="$TEST_TEMP_DIR/source"
  local digest_file="$TEST_TEMP_DIR/digest.db"
  
  mkdir -p "$test_dir"
  
  # Skip if filesystem doesn't support risky characters
  if ! filesystem_supports_risky_chars "$test_dir"; then
    skip "Filesystem does not support creating files with risky characters"
  fi
  
  try_create_risky_file "$test_dir/file:name.txt" "risky content"
  
  run file-sentinel digest -i "$test_dir::$digest_file" --compatibility-risk-strategy=mitigate-or-skip --no-tty
  [ "$status" -eq 0 ]
  
  # Should either rename or skip (both are valid outcomes)
  # If rename succeeds, file should be renamed
  # If rename fails, file should be skipped
  local digest_count=$(get_digest_file_count "$digest_file")
  [ "$digest_count" -ge 0 ]
  [ "$digest_count" -le 1 ]
}

@test "digest: --compatibility-risk-strategy=mitigate-or-accept-risk renames or accepts" {
  local test_dir="$TEST_TEMP_DIR/source"
  local digest_file="$TEST_TEMP_DIR/digest.db"
  
  mkdir -p "$test_dir"
  
  # Skip if filesystem doesn't support risky characters
  if ! filesystem_supports_risky_chars "$test_dir"; then
    skip "Filesystem does not support creating files with risky characters"
  fi
  
  try_create_risky_file "$test_dir/file:name.txt" "risky content"
  
  run file-sentinel digest -i "$test_dir::$digest_file" --compatibility-risk-strategy=mitigate-or-accept-risk --no-tty
  [ "$status" -eq 0 ]
  
  # Should either rename or accept (both are valid outcomes)
  local digest_count=$(get_digest_file_count "$digest_file")
  [ "$digest_count" -eq 1 ]
}

@test "digest: --compatibility-risk-strategy handles multiple risky characters" {
  local test_dir="$TEST_TEMP_DIR/source"
  local digest_file="$TEST_TEMP_DIR/digest.db"
  
  mkdir -p "$test_dir"
  
  # Skip if filesystem doesn't support risky characters
  if ! filesystem_supports_risky_chars "$test_dir"; then
    skip "Filesystem does not support creating files with risky characters"
  fi
  
  # Create files with various problematic characters (only if filesystem supports them)
  create_test_file "$test_dir/normal.txt" "normal"
  try_create_risky_file "$test_dir/file:name.txt" "colon" || true
  try_create_risky_file "$test_dir/file<name.txt" "less than" || true
  try_create_risky_file "$test_dir/file>name.txt" "greater than" || true
  try_create_risky_file "$test_dir/file|name.txt" "pipe" || true
  
  run file-sentinel digest -i "$test_dir::$digest_file" --compatibility-risk-strategy=skip --no-tty
  [ "$status" -eq 0 ]
  
  # Only normal file should be in digest (risky files should be skipped)
  local digest_count=$(get_digest_file_count "$digest_file")
  [ "$digest_count" -eq 1 ]
}

@test "digest: --compatibility-risk-strategy invalid value fails" {
  local test_dir="$TEST_TEMP_DIR/source"
  local digest_file="$TEST_TEMP_DIR/digest.db"
  
  mkdir -p "$test_dir"
  create_test_file "$test_dir/test.txt" "test"
  
  run file-sentinel digest -i "$test_dir::$digest_file" --compatibility-risk-strategy=invalid --no-tty
  [ "$status" -ne 0 ]
  [[ "$output" =~ "Invalid compatibility-risk-strategy" ]] || [[ "$output" =~ "invalid" ]]
}
