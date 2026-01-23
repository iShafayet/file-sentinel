#!/usr/bin/env bash

# Run all File Sentinel CLI tests
# This script runs all BATS test suites and provides a summary

set -e

# Colors for output (if TTY)
if [ -t 1 ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  BLUE='\033[0;34m'
  NC='\033[0m' # No Color
else
  RED=''
  GREEN=''
  YELLOW=''
  BLUE=''
  NC=''
fi

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}File Sentinel CLI Test Suite${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Check if file-sentinel is installed
if ! command -v file-sentinel &> /dev/null; then
  echo -e "${RED}ERROR: file-sentinel CLI not found in PATH${NC}"
  echo ""
  echo "Please install the CLI first:"
  echo "  cd .."
  echo "  npm run install-cli"
  echo ""
  exit 1
fi

# Check if BATS is installed
if ! command -v bats &> /dev/null && ! [ -x "node_modules/.bin/bats" ]; then
  echo -e "${RED}ERROR: BATS not found${NC}"
  echo ""
  echo "Please install dependencies first:"
  echo "  npm install"
  echo ""
  exit 1
fi

# Use local BATS if available, otherwise use global
if [ -x "node_modules/.bin/bats" ]; then
  BATS="node_modules/.bin/bats"
else
  BATS="bats"
fi

echo -e "${YELLOW}Using file-sentinel:${NC} $(which file-sentinel)"
echo -e "${YELLOW}Version:${NC} $(file-sentinel --version 2>&1 || echo 'unknown')"
echo ""

# Track results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
FAILED_SUITES=()

# Function to run a test suite
run_test_suite() {
  local test_file="$1"
  local test_name=$(basename "$test_file" .bats)
  
  echo -e "${BLUE}Running ${test_name}...${NC}"
  
  if $BATS "$test_file"; then
    echo -e "${GREEN}✓ ${test_name} passed${NC}"
    echo ""
    return 0
  else
    echo -e "${RED}✗ ${test_name} failed${NC}"
    echo ""
    FAILED_SUITES+=("$test_name")
    return 1
  fi
}

# Run all test suites
test_files=(
  "test-digest.bats"
  "test-verify.bats"
  "test-replicate.bats"
  "test-heal.bats"
  "test-compare.bats"
)

for test_file in "${test_files[@]}"; do
  if [ -f "$test_file" ]; then
    if run_test_suite "$test_file"; then
      ((PASSED_TESTS++))
    else
      ((FAILED_TESTS++))
    fi
    ((TOTAL_TESTS++))
  else
    echo -e "${YELLOW}Warning: $test_file not found, skipping${NC}"
  fi
done

# Print summary
echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}================================${NC}"
echo ""
echo -e "Total test suites: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"

if [ $FAILED_TESTS -gt 0 ]; then
  echo -e "${RED}Failed: $FAILED_TESTS${NC}"
  echo ""
  echo -e "${RED}Failed suites:${NC}"
  for suite in "${FAILED_SUITES[@]}"; do
    echo -e "  - $suite"
  done
  echo ""
  exit 1
else
  echo -e "${GREEN}All tests passed! ✓${NC}"
  echo ""
  exit 0
fi
