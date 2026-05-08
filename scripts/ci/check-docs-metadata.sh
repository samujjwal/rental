#!/bin/bash
# CI check: Validate that all canonical docs have required metadata blocks

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter for errors
ERRORS=0
WARNINGS=0

# Function to check metadata in a markdown file
check_metadata() {
  local file="$1"
  local is_archive="$2"
  
  # Check if file has frontmatter
  if ! head -n 1 "$file" | grep -q '^---'; then
    echo -e "${RED}✗ Missing metadata block in: $file${NC}"
    ((ERRORS++))
    return 1
  fi
  
  # Extract frontmatter (lines between first and second ---)
  local frontmatter=$(awk '/^---/{if(p)exit; p=1;next} p' "$file")
  
  # Check required fields for canonical docs
  if [ "$is_archive" = "false" ]; then
    for field in "status:" "owner:" "last_reviewed:" "source_of_truth:"; do
      if ! echo "$frontmatter" | grep -q "$field"; then
        echo -e "${RED}✗ Missing required field '$field' in: $file${NC}"
        ((ERRORS++))
      fi
    done
    
    # Check status value is valid
    local status=$(echo "$frontmatter" | grep "status:" | cut -d':' -f2 | xargs)
    if [[ ! "$status" =~ ^(canonical|draft|deprecated)$ ]]; then
      echo -e "${YELLOW}⚠ Invalid status '$status' in: $file (must be canonical, draft, or deprecated)${NC}"
      ((WARNINGS++))
    fi
  else
    # Archive docs should have archive-specific metadata
    if ! echo "$frontmatter" | grep -q "status:"; then
      echo -e "${YELLOW}⚠ Missing status field in archive doc: $file${NC}"
      ((WARNINGS++))
    fi
    
    local status=$(echo "$frontmatter" | grep "status:" | cut -d':' -f2 | xargs)
    if [[ ! "$status" =~ ^(archived|historical)$ ]]; then
      echo -e "${YELLOW}⚠ Invalid status '$status' in archive doc: $file (should be archived or historical)${NC}"
      ((WARNINGS++))
    fi
  fi
}

# Find all markdown files in docs/
echo "Checking documentation metadata..."
echo ""

# Check canonical docs (not in archive/)
while IFS= read -r -d '' file; do
  check_metadata "$file" "false"
done < <(find docs -name "*.md" -not -path "docs/archive/*" -not -path "docs/.git/*" -print0)

# Check archive docs
while IFS= read -r -d '' file; do
  check_metadata "$file" "true"
done < <(find docs/archive -name "*.md" -print0)

echo ""
echo "================================"
echo -e "Errors: ${RED}${ERRORS}${NC}"
echo -e "Warnings: ${YELLOW}${WARNINGS}${NC}"
echo "================================"

if [ $ERRORS -gt 0 ]; then
  echo -e "${RED}Documentation metadata check failed${NC}"
  exit 1
fi

if [ $WARNINGS -gt 0 ]; then
  echo -e "${YELLOW}Documentation metadata check passed with warnings${NC}"
  exit 0
fi

echo -e "${GREEN}Documentation metadata check passed${NC}"
exit 0
