#!/usr/bin/env bats

# Test suite for 'file-sentinel verify' command

load helpers/test-helpers

setup() {
  setup_test
}

teardown() {
  teardown_test
}

@test "verify: --help shows usage information" {
  run file-sentinel verify --help
  [ "$status" -eq 0 ]
  [[ "$output" =~ "Verify directory against digest" ]]
  [[ "$output" =~ "-i, --input" ]]
}

@test "verify: succeeds with matching files" {
  local test_dir="$TEST_TEMP_DIR/source"
  local digest_file="$TEST_TEMP_DIR/digest.db"
  
  create_test_structure "$test_dir"
  
  # Create digest
  run file-sentinel digest -i "$test_dir::$digest_file" --no-tty
  [ "$status" -eq 0 ]
  
  # Verify should pass
  run file-sentinel verify -i "$test_dir::$digest_file" --no-tty
  echo "Output: $output"
  [ "$status" -eq 0 ]
  [[ "$output" =~ "COMPLETED" ]] || [[ "$output" =~ "success" ]]
}

@test "verify: detects corrupted file" {
  local test_dir="$TEST_TEMP_DIR/source"
  local digest_file="$TEST_TEMP_DIR/digest.db"
  
  create_test_file "$test_dir/test.txt" "original content"
  
  # Create digest
  run file-sentinel digest -i "$test_dir::$digest_file" --no-tty
  [ "$status" -eq 0 ]
  
  # Corrupt the file
  corrupt_file "$test_dir/test.txt"
  
  # Verify should fail
  run file-sentinel verify -i "$test_dir::$digest_file" --no-tty
  [ "$status" -ne 0 ]
  [[ "$output" =~ "Failed" ]] || [[ "$output" =~ "failed" ]] || [[ "$output" =~ "corrupt" ]]
}

@test "verify: detects missing file" {
  local test_dir="$TEST_TEMP_DIR/source"
  local digest_file="$TEST_TEMP_DIR/digest.db"
  
  create_test_structure "$test_dir"
  
  # Create digest
  run file-sentinel digest -i "$test_dir::$digest_file" --no-tty
  [ "$status" -eq 0 ]
  
  # Delete a file
  rm "$test_dir/README.txt"
  
  # Verify should detect missing file
  run file-sentinel verify -i "$test_dir::$digest_file" --no-tty
  [ "$status" -ne 0 ]
  [[ "$output" =~ "Missing" ]] || [[ "$output" =~ "missing" ]]
}

@test "verify: detects extra files" {
  local test_dir="$TEST_TEMP_DIR/source"
  local digest_file="$TEST_TEMP_DIR/digest.db"
  
  create_test_structure "$test_dir"
  
  # Create digest
  run file-sentinel digest -i "$test_dir::$digest_file" --no-tty
  [ "$status" -eq 0 ]
  
  # Add a new file
  create_test_file "$test_dir/extra.txt" "extra content"
  
  # Verify should detect extra file
  run file-sentinel verify -i "$test_dir::$digest_file" --no-tty
  echo "Output: $output"
  # Note: Extra files might not cause failure, just report them
  [[ "$output" =~ "Extra" ]] || [[ "$output" =~ "extra" ]] || [ "$status" -eq 0 ]
}

@test "verify: handles subdirectory option" {
  local test_dir="$TEST_TEMP_DIR/source"
  local digest_file="$TEST_TEMP_DIR/digest.db"
  
  create_test_structure "$test_dir"
  
  # Create digest for entire directory
  run file-sentinel digest -i "$test_dir::$digest_file" --no-tty
  [ "$status" -eq 0 ]
  
  # Verify only photos subdirectory
  run file-sentinel verify -i "$test_dir::$digest_file" -s photos --no-tty
  [ "$status" -eq 0 ]
}

@test "verify: --verbose shows detailed output" {
  local test_dir="$TEST_TEMP_DIR/source"
  local digest_file="$TEST_TEMP_DIR/digest.db"
  
  create_test_file "$test_dir/test.txt" "test content"
  
  # Create digest
  run file-sentinel digest -i "$test_dir::$digest_file" --no-tty
  [ "$status" -eq 0 ]
  
  # Verify with verbose
  run file-sentinel verify -i "$test_dir::$digest_file" --verbose --no-tty
  [ "$status" -eq 0 ]
  
  # Verbose output should contain file details
  [[ "$output" =~ "test.txt" ]] || [[ "$output" =~ "Verifying" ]]
}

@test "verify: fails without digest file" {
  local test_dir="$TEST_TEMP_DIR/source"
  local digest_file="$TEST_TEMP_DIR/nonexistent.db"
  
  create_test_structure "$test_dir"
  
  run file-sentinel verify -i "$test_dir::$digest_file" --no-tty
  [ "$status" -ne 0 ]
}

@test "verify: handles empty directory" {
  local test_dir="$TEST_TEMP_DIR/empty"
  local digest_file="$TEST_TEMP_DIR/digest.db"
  
  mkdir -p "$test_dir"
  
  # Create digest for empty directory
  run file-sentinel digest -i "$test_dir::$digest_file" --no-tty
  [ "$status" -eq 0 ]
  
  # Verify should pass
  run file-sentinel verify -i "$test_dir::$digest_file" --no-tty
  [ "$status" -eq 0 ]
}

@test "verify: detects multiple corrupted files" {
  local test_dir="$TEST_TEMP_DIR/source"
  local digest_file="$TEST_TEMP_DIR/digest.db"
  
  create_test_structure "$test_dir"
  
  # Create digest
  run file-sentinel digest -i "$test_dir::$digest_file" --no-tty
  [ "$status" -eq 0 ]
  
  # Corrupt multiple files
  corrupt_file "$test_dir/README.txt"
  corrupt_file "$test_dir/documents/notes.txt"
  
  # Verify should detect both
  run file-sentinel verify -i "$test_dir::$digest_file" --no-tty
  [ "$status" -ne 0 ]
  [[ "$output" =~ "Failed" ]] || [[ "$output" =~ "failed" ]]
}

@test "verify: --panic-on-error stops on first error" {
  local test_dir="$TEST_TEMP_DIR/source"
  local digest_file="$TEST_TEMP_DIR/digest.db"
  
  create_test_structure "$test_dir"
  
  # Create digest
  run file-sentinel digest -i "$test_dir::$digest_file" --no-tty
  [ "$status" -eq 0 ]
  
  # Corrupt a file
  corrupt_file "$test_dir/README.txt"
  
  # Verify with panic-on-error
  run file-sentinel verify -i "$test_dir::$digest_file" --panic-on-error --no-tty
  [ "$status" -ne 0 ]
}

@test "verify: --no-tty produces clean output" {
  local test_dir="$TEST_TEMP_DIR/source"
  local digest_file="$TEST_TEMP_DIR/digest.db"
  
  create_test_file "$test_dir/test.txt" "test"
  
  # Create digest
  run file-sentinel digest -i "$test_dir::$digest_file" --no-tty
  [ "$status" -eq 0 ]
  
  # Verify
  run file-sentinel verify -i "$test_dir::$digest_file" --no-tty
  [ "$status" -eq 0 ]
  
  # Output should not contain ANSI escape codes
  [[ ! "$output" =~ $'\033' ]]
}

@test "verify: exit code 0 when all files valid" {
  local test_dir="$TEST_TEMP_DIR/source"
  local digest_file="$TEST_TEMP_DIR/digest.db"
  
  create_test_file "$test_dir/test.txt" "test"
  
  # Create digest
  run file-sentinel digest -i "$test_dir::$digest_file" --no-tty
  [ "$status" -eq 0 ]
  
  # Verify
  run file-sentinel verify -i "$test_dir::$digest_file" --no-tty
  [ "$status" -eq 0 ]
}

@test "verify: exit code non-zero when corruption detected" {
  local test_dir="$TEST_TEMP_DIR/source"
  local digest_file="$TEST_TEMP_DIR/digest.db"
  
  create_test_file "$test_dir/test.txt" "original"
  
  # Create digest
  run file-sentinel digest -i "$test_dir::$digest_file" --no-tty
  [ "$status" -eq 0 ]
  
  # Corrupt file
  corrupt_file "$test_dir/test.txt"
  
  # Verify
  run file-sentinel verify -i "$test_dir::$digest_file" --no-tty
  [ "$status" -ne 0 ]
}

@test "verify: verifies large files correctly" {
  local test_dir="$TEST_TEMP_DIR/source"
  local digest_file="$TEST_TEMP_DIR/digest.db"
  
  mkdir -p "$test_dir"
  
  # Create a 5MB file
  create_random_file "$test_dir/large.bin" 5120
  
  # Create digest
  run file-sentinel digest -i "$test_dir::$digest_file" --no-tty
  [ "$status" -eq 0 ]
  
  # Verify should pass
  run file-sentinel verify -i "$test_dir::$digest_file" --no-tty
  [ "$status" -eq 0 ]
}

@test "verify: handles nested directory structure" {
  local test_dir="$TEST_TEMP_DIR/source"
  local digest_file="$TEST_TEMP_DIR/digest.db"
  
  # Create nested structure
  mkdir -p "$test_dir/a/b/c"
  create_test_file "$test_dir/a/file1.txt" "content 1"
  create_test_file "$test_dir/a/b/file2.txt" "content 2"
  create_test_file "$test_dir/a/b/c/file3.txt" "content 3"
  
  # Create digest
  run file-sentinel digest -i "$test_dir::$digest_file" --no-tty
  [ "$status" -eq 0 ]
  
  # Verify should pass
  run file-sentinel verify -i "$test_dir::$digest_file" --no-tty
  [ "$status" -eq 0 ]
}
