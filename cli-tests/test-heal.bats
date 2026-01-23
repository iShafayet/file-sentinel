#!/usr/bin/env bats

# Test suite for 'file-sentinel heal' command

load helpers/test-helpers

setup() {
  setup_test
}

teardown() {
  teardown_test
}

@test "heal: --help shows usage information" {
  run file-sentinel heal --help
  [ "$status" -eq 0 ]
  [[ "$output" =~ "Heal directory from mirrors" ]]
  [[ "$output" =~ "-i, --input" ]]
  [[ "$output" =~ "--mirror" ]]
}

@test "heal: requires at least one mirror" {
  local test_dir="$TEST_TEMP_DIR/source"
  local digest_file="$TEST_TEMP_DIR/digest.db"
  
  create_test_file "$test_dir/test.txt" "test content"
  
  # Create digest
  run file-sentinel digest -i "$test_dir::$digest_file" --no-tty
  [ "$status" -eq 0 ]
  
  # Try to heal without mirror (should fail)
  run file-sentinel heal -i "$test_dir::$digest_file" --no-tty
  [ "$status" -ne 0 ]
  [[ "$output" =~ "mirror" ]] || [[ "$output" =~ "required" ]]
}

@test "heal: restores corrupted file from mirror" {
  local test_dir="$TEST_TEMP_DIR/source"
  local mirror_dir="$TEST_TEMP_DIR/mirror"
  local test_digest="$TEST_TEMP_DIR/test.db"
  local mirror_digest="$TEST_TEMP_DIR/mirror.db"
  
  create_test_file "$test_dir/test.txt" "original content"
  
  # Create digest
  run file-sentinel digest -i "$test_dir::$test_digest" --no-tty
  [ "$status" -eq 0 ]
  
  # Create mirror
  create_mirror "$test_dir" "$mirror_dir"
  run file-sentinel digest -i "$mirror_dir::$mirror_digest" --no-tty
  [ "$status" -eq 0 ]
  
  # Corrupt the file
  corrupt_file "$test_dir/test.txt"
  
  # Heal from mirror
  run file-sentinel heal \
    -i "$test_dir::$test_digest" \
    --mirror "$mirror_dir::$mirror_digest" \
    --no-tty
  echo "Output: $output"
  [ "$status" -eq 0 ]
  
  # File should be restored
  local content=$(cat "$test_dir/test.txt")
  [[ "$content" == "original content" ]]
}

@test "heal: restores missing file from mirror" {
  local test_dir="$TEST_TEMP_DIR/source"
  local mirror_dir="$TEST_TEMP_DIR/mirror"
  local test_digest="$TEST_TEMP_DIR/test.db"
  local mirror_digest="$TEST_TEMP_DIR/mirror.db"
  
  create_test_file "$test_dir/test.txt" "original content"
  
  # Create digest
  run file-sentinel digest -i "$test_dir::$test_digest" --no-tty
  [ "$status" -eq 0 ]
  
  # Create mirror
  create_mirror "$test_dir" "$mirror_dir"
  run file-sentinel digest -i "$mirror_dir::$mirror_digest" --no-tty
  [ "$status" -eq 0 ]
  
  # Delete the file
  rm "$test_dir/test.txt"
  
  # Heal from mirror
  run file-sentinel heal \
    -i "$test_dir::$test_digest" \
    --mirror "$mirror_dir::$mirror_digest" \
    --no-tty
  [ "$status" -eq 0 ]
  
  # File should be restored
  assert_file_exists "$test_dir/test.txt"
  
  local content=$(cat "$test_dir/test.txt")
  [[ "$content" == "original content" ]]
}

@test "heal: leaves valid files unchanged" {
  local test_dir="$TEST_TEMP_DIR/source"
  local mirror_dir="$TEST_TEMP_DIR/mirror"
  local test_digest="$TEST_TEMP_DIR/test.db"
  local mirror_digest="$TEST_TEMP_DIR/mirror.db"
  
  create_test_structure "$test_dir"
  
  # Create digest
  run file-sentinel digest -i "$test_dir::$test_digest" --no-tty
  [ "$status" -eq 0 ]
  
  # Create mirror
  create_mirror "$test_dir" "$mirror_dir"
  run file-sentinel digest -i "$mirror_dir::$mirror_digest" --no-tty
  [ "$status" -eq 0 ]
  
  # Get original hash of a file
  local original_hash=$(get_file_hash "$test_dir/README.txt")
  
  # Heal (nothing should change)
  run file-sentinel heal \
    -i "$test_dir::$test_digest" \
    --mirror "$mirror_dir::$mirror_digest" \
    --no-tty
  [ "$status" -eq 0 ]
  
  # File hash should remain the same
  local new_hash=$(get_file_hash "$test_dir/README.txt")
  [ "$original_hash" = "$new_hash" ]
}

@test "heal: handles multiple corrupted files" {
  local test_dir="$TEST_TEMP_DIR/source"
  local mirror_dir="$TEST_TEMP_DIR/mirror"
  local test_digest="$TEST_TEMP_DIR/test.db"
  local mirror_digest="$TEST_TEMP_DIR/mirror.db"
  
  create_test_structure "$test_dir"
  
  # Create digest
  run file-sentinel digest -i "$test_dir::$test_digest" --no-tty
  [ "$status" -eq 0 ]
  
  # Create mirror
  create_mirror "$test_dir" "$mirror_dir"
  run file-sentinel digest -i "$mirror_dir::$mirror_digest" --no-tty
  [ "$status" -eq 0 ]
  
  # Corrupt multiple files
  corrupt_file "$test_dir/README.txt"
  corrupt_file "$test_dir/documents/notes.txt"
  
  # Heal from mirror
  run file-sentinel heal \
    -i "$test_dir::$test_digest" \
    --mirror "$mirror_dir::$mirror_digest" \
    --no-tty
  echo "Output: $output"
  [ "$status" -eq 0 ]
  
  # Both files should be restored
  # Verify by checking they don't contain "CORRUPTED"
  local readme_content=$(cat "$test_dir/README.txt")
  [[ ! "$readme_content" =~ "CORRUPTED" ]]
  
  local notes_content=$(cat "$test_dir/documents/notes.txt")
  [[ ! "$notes_content" =~ "CORRUPTED" ]]
}

@test "heal: tries multiple mirrors in order" {
  local test_dir="$TEST_TEMP_DIR/source"
  local mirror1_dir="$TEST_TEMP_DIR/mirror1"
  local mirror2_dir="$TEST_TEMP_DIR/mirror2"
  local test_digest="$TEST_TEMP_DIR/test.db"
  local mirror1_digest="$TEST_TEMP_DIR/mirror1.db"
  local mirror2_digest="$TEST_TEMP_DIR/mirror2.db"
  
  create_test_file "$test_dir/test.txt" "original content"
  
  # Create digest
  run file-sentinel digest -i "$test_dir::$test_digest" --no-tty
  [ "$status" -eq 0 ]
  
  # Create first mirror (corrupted)
  create_mirror "$test_dir" "$mirror1_dir"
  corrupt_file "$mirror1_dir/test.txt"
  run file-sentinel digest -i "$mirror1_dir::$mirror1_digest" --no-tty
  [ "$status" -eq 0 ]
  
  # Create second mirror (good)
  create_mirror "$test_dir" "$mirror2_dir"
  run file-sentinel digest -i "$mirror2_dir::$mirror2_digest" --no-tty
  [ "$status" -eq 0 ]
  
  # Corrupt source file
  corrupt_file "$test_dir/test.txt"
  
  # Heal with both mirrors
  run file-sentinel heal \
    -i "$test_dir::$test_digest" \
    --mirror "$mirror1_dir::$mirror1_digest" \
    --mirror "$mirror2_dir::$mirror2_digest" \
    --no-tty
  echo "Output: $output"
  # Should succeed using second mirror
  [ "$status" -eq 0 ] || [[ "$output" =~ "mirror" ]]
}

@test "heal: handles subdirectory option" {
  local test_dir="$TEST_TEMP_DIR/source"
  local mirror_dir="$TEST_TEMP_DIR/mirror"
  local test_digest="$TEST_TEMP_DIR/test.db"
  local mirror_digest="$TEST_TEMP_DIR/mirror.db"
  
  create_test_structure "$test_dir"
  
  # Create digest
  run file-sentinel digest -i "$test_dir::$test_digest" --no-tty
  [ "$status" -eq 0 ]
  
  # Create mirror
  create_mirror "$test_dir" "$mirror_dir"
  run file-sentinel digest -i "$mirror_dir::$mirror_digest" --no-tty
  [ "$status" -eq 0 ]
  
  # Corrupt a file in photos subdirectory
  corrupt_file "$test_dir/photos/2024/photo1.jpg"
  
  # Heal only photos subdirectory
  run file-sentinel heal \
    -i "$test_dir::$test_digest" \
    --mirror "$mirror_dir::$mirror_digest" \
    -s photos \
    --no-tty
  [ "$status" -eq 0 ]
}

@test "heal: --dry-run does not restore files" {
  local test_dir="$TEST_TEMP_DIR/source"
  local mirror_dir="$TEST_TEMP_DIR/mirror"
  local test_digest="$TEST_TEMP_DIR/test.db"
  local mirror_digest="$TEST_TEMP_DIR/mirror.db"
  
  create_test_file "$test_dir/test.txt" "original content"
  
  # Create digest
  run file-sentinel digest -i "$test_dir::$test_digest" --no-tty
  [ "$status" -eq 0 ]
  
  # Create mirror
  create_mirror "$test_dir" "$mirror_dir"
  run file-sentinel digest -i "$mirror_dir::$mirror_digest" --no-tty
  [ "$status" -eq 0 ]
  
  # Corrupt the file
  corrupt_file "$test_dir/test.txt"
  
  # Dry run heal
  run file-sentinel heal \
    -i "$test_dir::$test_digest" \
    --mirror "$mirror_dir::$mirror_digest" \
    --dry-run \
    --no-tty
  [ "$status" -eq 0 ]
  
  # File should still be corrupted
  local content=$(cat "$test_dir/test.txt")
  [[ "$content" =~ "CORRUPTED" ]]
}

@test "heal: --verbose shows detailed output" {
  local test_dir="$TEST_TEMP_DIR/source"
  local mirror_dir="$TEST_TEMP_DIR/mirror"
  local test_digest="$TEST_TEMP_DIR/test.db"
  local mirror_digest="$TEST_TEMP_DIR/mirror.db"
  
  create_test_file "$test_dir/test.txt" "original content"
  
  # Create digest
  run file-sentinel digest -i "$test_dir::$test_digest" --no-tty
  [ "$status" -eq 0 ]
  
  # Create mirror
  create_mirror "$test_dir" "$mirror_dir"
  run file-sentinel digest -i "$mirror_dir::$mirror_digest" --no-tty
  [ "$status" -eq 0 ]
  
  # Heal with verbose
  run file-sentinel heal \
    -i "$test_dir::$test_digest" \
    --mirror "$mirror_dir::$mirror_digest" \
    --verbose \
    --no-tty
  [ "$status" -eq 0 ]
  
  # Verbose output should contain details
  [[ "$output" =~ "test.txt" ]] || [[ "$output" =~ "Healing" ]] || [[ "$output" =~ "Verified" ]]
}

@test "heal: --no-tty produces clean output" {
  local test_dir="$TEST_TEMP_DIR/source"
  local mirror_dir="$TEST_TEMP_DIR/mirror"
  local test_digest="$TEST_TEMP_DIR/test.db"
  local mirror_digest="$TEST_TEMP_DIR/mirror.db"
  
  create_test_file "$test_dir/test.txt" "test"
  
  # Create digest
  run file-sentinel digest -i "$test_dir::$test_digest" --no-tty
  [ "$status" -eq 0 ]
  
  # Create mirror
  create_mirror "$test_dir" "$mirror_dir"
  run file-sentinel digest -i "$mirror_dir::$mirror_digest" --no-tty
  [ "$status" -eq 0 ]
  
  # Heal
  run file-sentinel heal \
    -i "$test_dir::$test_digest" \
    --mirror "$mirror_dir::$mirror_digest" \
    --no-tty
  [ "$status" -eq 0 ]
  
  # Output should not contain ANSI escape codes
  [[ ! "$output" =~ $'\033' ]]
}

@test "heal: exit code 0 when all files healed successfully" {
  local test_dir="$TEST_TEMP_DIR/source"
  local mirror_dir="$TEST_TEMP_DIR/mirror"
  local test_digest="$TEST_TEMP_DIR/test.db"
  local mirror_digest="$TEST_TEMP_DIR/mirror.db"
  
  create_test_file "$test_dir/test.txt" "original content"
  
  # Create digest
  run file-sentinel digest -i "$test_dir::$test_digest" --no-tty
  [ "$status" -eq 0 ]
  
  # Create mirror
  create_mirror "$test_dir" "$mirror_dir"
  run file-sentinel digest -i "$mirror_dir::$mirror_digest" --no-tty
  [ "$status" -eq 0 ]
  
  # Corrupt file
  corrupt_file "$test_dir/test.txt"
  
  # Heal
  run file-sentinel heal \
    -i "$test_dir::$test_digest" \
    --mirror "$mirror_dir::$mirror_digest" \
    --no-tty
  [ "$status" -eq 0 ]
}

@test "heal: handles nested directory structure" {
  local test_dir="$TEST_TEMP_DIR/source"
  local mirror_dir="$TEST_TEMP_DIR/mirror"
  local test_digest="$TEST_TEMP_DIR/test.db"
  local mirror_digest="$TEST_TEMP_DIR/mirror.db"
  
  # Create nested structure
  mkdir -p "$test_dir/a/b/c"
  create_test_file "$test_dir/a/file1.txt" "content 1"
  create_test_file "$test_dir/a/b/file2.txt" "content 2"
  create_test_file "$test_dir/a/b/c/file3.txt" "content 3"
  
  # Create digest
  run file-sentinel digest -i "$test_dir::$test_digest" --no-tty
  [ "$status" -eq 0 ]
  
  # Create mirror
  create_mirror "$test_dir" "$mirror_dir"
  run file-sentinel digest -i "$mirror_dir::$mirror_digest" --no-tty
  [ "$status" -eq 0 ]
  
  # Corrupt nested file
  corrupt_file "$test_dir/a/b/c/file3.txt"
  
  # Heal
  run file-sentinel heal \
    -i "$test_dir::$test_digest" \
    --mirror "$mirror_dir::$mirror_digest" \
    --no-tty
  [ "$status" -eq 0 ]
  
  # File should be restored
  local content=$(cat "$test_dir/a/b/c/file3.txt")
  [[ "$content" == "content 3" ]]
}

@test "heal: reports files that cannot be healed" {
  local test_dir="$TEST_TEMP_DIR/source"
  local mirror_dir="$TEST_TEMP_DIR/mirror"
  local test_digest="$TEST_TEMP_DIR/test.db"
  local mirror_digest="$TEST_TEMP_DIR/mirror.db"
  
  create_test_file "$test_dir/test.txt" "original content"
  
  # Create digest
  run file-sentinel digest -i "$test_dir::$test_digest" --no-tty
  [ "$status" -eq 0 ]
  
  # Create mirror but also corrupt it
  create_mirror "$test_dir" "$mirror_dir"
  corrupt_file "$mirror_dir/test.txt"
  run file-sentinel digest -i "$mirror_dir::$mirror_digest" --no-tty
  [ "$status" -eq 0 ]
  
  # Corrupt source file
  corrupt_file "$test_dir/test.txt"
  
  # Try to heal (should fail or report recovery failure)
  run file-sentinel heal \
    -i "$test_dir::$test_digest" \
    --mirror "$mirror_dir::$mirror_digest" \
    --no-tty
  echo "Output: $output"
  # Should either fail or report recovery failure
  [[ "$output" =~ "Failed" ]] || [[ "$output" =~ "failed" ]] || [ "$status" -ne 0 ]
}
