#!/usr/bin/env bats

# Test suite for 'file-sentinel compare' command

load helpers/test-helpers

setup() {
  setup_test
}

teardown() {
  teardown_test
}

@test "compare: --help shows usage information" {
  run file-sentinel compare --help
  [ "$status" -eq 0 ]
  [[ "$output" =~ "Compare two digests" ]]
  [[ "$output" =~ "--local" ]]
  [[ "$output" =~ "--remote" ]]
}

@test "compare: compares two identical digests" {
  local dir1="$TEST_TEMP_DIR/dir1"
  local dir2="$TEST_TEMP_DIR/dir2"
  local digest1="$TEST_TEMP_DIR/digest1.db"
  local digest2="$TEST_TEMP_DIR/digest2.db"
  
  create_test_structure "$dir1"
  create_test_structure "$dir2"
  
  # Create both digests
  run file-sentinel digest -i "$dir1::$digest1" --no-tty
  [ "$status" -eq 0 ]
  
  run file-sentinel digest -i "$dir2::$digest2" --no-tty
  [ "$status" -eq 0 ]
  
  # Compare
  run file-sentinel compare --local "$digest1" --remote "$digest2" --no-tty
  echo "Output: $output"
  [ "$status" -eq 0 ]
  
  # Should show no differences (or minimal differences)
  [[ "$output" =~ "COMPARE" ]] || [[ "$output" =~ "Compare" ]]
}

@test "compare: detects new files in local" {
  local dir1="$TEST_TEMP_DIR/dir1"
  local dir2="$TEST_TEMP_DIR/dir2"
  local digest1="$TEST_TEMP_DIR/digest1.db"
  local digest2="$TEST_TEMP_DIR/digest2.db"
  
  create_test_structure "$dir1"
  create_test_structure "$dir2"
  
  # Add extra file to dir1
  create_test_file "$dir1/newfile.txt" "new content"
  
  # Create both digests
  run file-sentinel digest -i "$dir1::$digest1" --no-tty
  [ "$status" -eq 0 ]
  
  run file-sentinel digest -i "$dir2::$digest2" --no-tty
  [ "$status" -eq 0 ]
  
  # Compare
  run file-sentinel compare --local "$digest1" --remote "$digest2" --no-tty
  echo "Output: $output"
  [ "$status" -eq 0 ]
  
  # Should show new file
  [[ "$output" =~ "New" ]] || [[ "$output" =~ "new" ]] || [[ "$output" =~ "newfile.txt" ]]
}

@test "compare: detects changed files" {
  local dir1="$TEST_TEMP_DIR/dir1"
  local dir2="$TEST_TEMP_DIR/dir2"
  local digest1="$TEST_TEMP_DIR/digest1.db"
  local digest2="$TEST_TEMP_DIR/digest2.db"
  
  create_test_structure "$dir1"
  create_test_structure "$dir2"
  
  # Create both digests
  run file-sentinel digest -i "$dir1::$digest1" --no-tty
  [ "$status" -eq 0 ]
  
  run file-sentinel digest -i "$dir2::$digest2" --no-tty
  [ "$status" -eq 0 ]
  
  # Modify a file in dir1
  create_test_file "$dir1/README.txt" "modified content"
  
  # Update digest1
  run file-sentinel digest -i "$dir1::$digest1" --no-tty
  [ "$status" -eq 0 ]
  
  # Compare
  run file-sentinel compare --local "$digest1" --remote "$digest2" --no-tty
  echo "Output: $output"
  [ "$status" -eq 0 ]
  
  # Should show changed file
  [[ "$output" =~ "Changed" ]] || [[ "$output" =~ "changed" ]] || [[ "$output" =~ "README.txt" ]]
}

@test "compare: detects deleted files" {
  local dir1="$TEST_TEMP_DIR/dir1"
  local dir2="$TEST_TEMP_DIR/dir2"
  local digest1="$TEST_TEMP_DIR/digest1.db"
  local digest2="$TEST_TEMP_DIR/digest2.db"
  
  create_test_structure "$dir1"
  create_test_structure "$dir2"
  
  # Create both digests
  run file-sentinel digest -i "$dir1::$digest1" --no-tty
  [ "$status" -eq 0 ]
  
  run file-sentinel digest -i "$dir2::$digest2" --no-tty
  [ "$status" -eq 0 ]
  
  # Delete a file from dir1
  rm "$dir1/README.txt"
  
  # Update digest1
  run file-sentinel digest -i "$dir1::$digest1" --no-tty
  [ "$status" -eq 0 ]
  
  # Compare
  run file-sentinel compare --local "$digest1" --remote "$digest2" --no-tty
  echo "Output: $output"
  [ "$status" -eq 0 ]
  
  # Should show deleted file
  [[ "$output" =~ "Deleted" ]] || [[ "$output" =~ "deleted" ]] || [[ "$output" =~ "README.txt" ]]
}

@test "compare: shows summary of differences" {
  local dir1="$TEST_TEMP_DIR/dir1"
  local dir2="$TEST_TEMP_DIR/dir2"
  local digest1="$TEST_TEMP_DIR/digest1.db"
  local digest2="$TEST_TEMP_DIR/digest2.db"
  
  create_test_structure "$dir1"
  create_test_structure "$dir2"
  
  # Create both digests
  run file-sentinel digest -i "$dir1::$digest1" --no-tty
  [ "$status" -eq 0 ]
  
  run file-sentinel digest -i "$dir2::$digest2" --no-tty
  [ "$status" -eq 0 ]
  
  # Make various changes to dir1
  create_test_file "$dir1/newfile.txt" "new"
  create_test_file "$dir1/README.txt" "modified"
  rm "$dir1/documents/notes.txt"
  
  # Update digest1
  run file-sentinel digest -i "$dir1::$digest1" --no-tty
  [ "$status" -eq 0 ]
  
  # Compare
  run file-sentinel compare --local "$digest1" --remote "$digest2" --no-tty
  echo "Output: $output"
  [ "$status" -eq 0 ]
  
  # Should show summary
  [[ "$output" =~ "New" ]] || [[ "$output" =~ "Changed" ]] || [[ "$output" =~ "Deleted" ]]
}

@test "compare: --verbose shows detailed file list" {
  local dir1="$TEST_TEMP_DIR/dir1"
  local dir2="$TEST_TEMP_DIR/dir2"
  local digest1="$TEST_TEMP_DIR/digest1.db"
  local digest2="$TEST_TEMP_DIR/digest2.db"
  
  create_test_structure "$dir1"
  create_test_structure "$dir2"
  
  # Add extra file to dir1
  create_test_file "$dir1/newfile.txt" "new content"
  
  # Create both digests
  run file-sentinel digest -i "$dir1::$digest1" --no-tty
  [ "$status" -eq 0 ]
  
  run file-sentinel digest -i "$dir2::$digest2" --no-tty
  [ "$status" -eq 0 ]
  
  # Compare with verbose
  run file-sentinel compare --local "$digest1" --remote "$digest2" --verbose --no-tty
  echo "Output: $output"
  [ "$status" -eq 0 ]
  
  # Verbose should show file details
  [[ "$output" =~ "newfile.txt" ]]
}

@test "compare: is read-only operation" {
  local dir1="$TEST_TEMP_DIR/dir1"
  local dir2="$TEST_TEMP_DIR/dir2"
  local digest1="$TEST_TEMP_DIR/digest1.db"
  local digest2="$TEST_TEMP_DIR/digest2.db"
  
  create_test_file "$dir1/test.txt" "content 1"
  create_test_file "$dir2/test.txt" "content 2"
  
  # Create both digests
  run file-sentinel digest -i "$dir1::$digest1" --no-tty
  [ "$status" -eq 0 ]
  
  run file-sentinel digest -i "$dir2::$digest2" --no-tty
  [ "$status" -eq 0 ]
  
  # Get modification times
  local digest1_mtime_before=$(stat -f%m "$digest1" 2>/dev/null || stat -c%Y "$digest1")
  local digest2_mtime_before=$(stat -f%m "$digest2" 2>/dev/null || stat -c%Y "$digest2")
  
  # Compare
  run file-sentinel compare --local "$digest1" --remote "$digest2" --no-tty
  [ "$status" -eq 0 ]
  
  # Wait a moment to ensure timestamp would change if modified
  sleep 1
  
  # Get modification times after
  local digest1_mtime_after=$(stat -f%m "$digest1" 2>/dev/null || stat -c%Y "$digest1")
  local digest2_mtime_after=$(stat -f%m "$digest2" 2>/dev/null || stat -c%Y "$digest2")
  
  # Digests should not be modified
  [ "$digest1_mtime_before" -eq "$digest1_mtime_after" ]
  [ "$digest2_mtime_before" -eq "$digest2_mtime_after" ]
}

@test "compare: fails with non-existent local digest" {
  local digest1="$TEST_TEMP_DIR/nonexistent1.db"
  local digest2="$TEST_TEMP_DIR/digest2.db"
  
  local dir2="$TEST_TEMP_DIR/dir2"
  create_test_file "$dir2/test.txt" "test"
  
  # Create only remote digest
  run file-sentinel digest -i "$dir2::$digest2" --no-tty
  [ "$status" -eq 0 ]
  
  # Compare with non-existent local
  run file-sentinel compare --local "$digest1" --remote "$digest2" --no-tty
  [ "$status" -ne 0 ]
}

@test "compare: fails with non-existent remote digest" {
  local digest1="$TEST_TEMP_DIR/digest1.db"
  local digest2="$TEST_TEMP_DIR/nonexistent2.db"
  
  local dir1="$TEST_TEMP_DIR/dir1"
  create_test_file "$dir1/test.txt" "test"
  
  # Create only local digest
  run file-sentinel digest -i "$dir1::$digest1" --no-tty
  [ "$status" -eq 0 ]
  
  # Compare with non-existent remote
  run file-sentinel compare --local "$digest1" --remote "$digest2" --no-tty
  [ "$status" -ne 0 ]
}

@test "compare: handles empty digests" {
  local dir1="$TEST_TEMP_DIR/empty1"
  local dir2="$TEST_TEMP_DIR/empty2"
  local digest1="$TEST_TEMP_DIR/digest1.db"
  local digest2="$TEST_TEMP_DIR/digest2.db"
  
  mkdir -p "$dir1"
  mkdir -p "$dir2"
  
  # Create both empty digests
  run file-sentinel digest -i "$dir1::$digest1" --no-tty
  [ "$status" -eq 0 ]
  
  run file-sentinel digest -i "$dir2::$digest2" --no-tty
  [ "$status" -eq 0 ]
  
  # Compare
  run file-sentinel compare --local "$digest1" --remote "$digest2" --no-tty
  [ "$status" -eq 0 ]
}

@test "compare: --no-tty produces clean output" {
  local dir1="$TEST_TEMP_DIR/dir1"
  local dir2="$TEST_TEMP_DIR/dir2"
  local digest1="$TEST_TEMP_DIR/digest1.db"
  local digest2="$TEST_TEMP_DIR/digest2.db"
  
  create_test_file "$dir1/test.txt" "test"
  create_test_file "$dir2/test.txt" "test"
  
  # Create both digests
  run file-sentinel digest -i "$dir1::$digest1" --no-tty
  [ "$status" -eq 0 ]
  
  run file-sentinel digest -i "$dir2::$digest2" --no-tty
  [ "$status" -eq 0 ]
  
  # Compare
  run file-sentinel compare --local "$digest1" --remote "$digest2" --no-tty
  [ "$status" -eq 0 ]
  
  # Output should not contain ANSI escape codes
  [[ ! "$output" =~ $'\033' ]]
}

@test "compare: exit code 0 on success" {
  local dir1="$TEST_TEMP_DIR/dir1"
  local dir2="$TEST_TEMP_DIR/dir2"
  local digest1="$TEST_TEMP_DIR/digest1.db"
  local digest2="$TEST_TEMP_DIR/digest2.db"
  
  create_test_file "$dir1/test.txt" "test"
  create_test_file "$dir2/test.txt" "test"
  
  # Create both digests
  run file-sentinel digest -i "$dir1::$digest1" --no-tty
  [ "$status" -eq 0 ]
  
  run file-sentinel digest -i "$dir2::$digest2" --no-tty
  [ "$status" -eq 0 ]
  
  # Compare
  run file-sentinel compare --local "$digest1" --remote "$digest2" --no-tty
  [ "$status" -eq 0 ]
}

@test "compare: predicts replicate operation" {
  local dir1="$TEST_TEMP_DIR/dir1"
  local dir2="$TEST_TEMP_DIR/dir2"
  local digest1="$TEST_TEMP_DIR/digest1.db"
  local digest2="$TEST_TEMP_DIR/digest2.db"
  
  create_test_structure "$dir1"
  create_test_structure "$dir2"
  
  # Make changes to dir1
  create_test_file "$dir1/newfile.txt" "new"
  
  # Create both digests
  run file-sentinel digest -i "$dir1::$digest1" --no-tty
  [ "$status" -eq 0 ]
  
  run file-sentinel digest -i "$dir2::$digest2" --no-tty
  [ "$status" -eq 0 ]
  
  # Compare
  run file-sentinel compare --local "$digest1" --remote "$digest2" --no-tty
  echo "Output: $output"
  [ "$status" -eq 0 ]
  
  # Should mention replication or prediction
  [[ "$output" =~ "replicate" ]] || [[ "$output" =~ "Replicate" ]] || [[ "$output" =~ "would" ]]
}

@test "compare: handles large number of differences" {
  local dir1="$TEST_TEMP_DIR/dir1"
  local dir2="$TEST_TEMP_DIR/dir2"
  local digest1="$TEST_TEMP_DIR/digest1.db"
  local digest2="$TEST_TEMP_DIR/digest2.db"
  
  mkdir -p "$dir1"
  mkdir -p "$dir2"
  
  # Create many files in dir1
  for i in {1..20}; do
    create_test_file "$dir1/file$i.txt" "content $i"
  done
  
  # Create different files in dir2
  for i in {1..10}; do
    create_test_file "$dir2/file$i.txt" "different content $i"
  done
  
  # Create both digests
  run file-sentinel digest -i "$dir1::$digest1" --no-tty
  [ "$status" -eq 0 ]
  
  run file-sentinel digest -i "$dir2::$digest2" --no-tty
  [ "$status" -eq 0 ]
  
  # Compare
  run file-sentinel compare --local "$digest1" --remote "$digest2" --no-tty
  [ "$status" -eq 0 ]
  
  # Should handle all differences
  [[ "$output" =~ "New" ]] || [[ "$output" =~ "Changed" ]]
}
