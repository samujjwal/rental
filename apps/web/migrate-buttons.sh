#!/bin/bash

# Migrate Button imports to UnifiedButton across the codebase
# This script updates all imports and basic usage patterns

echo "Starting Button to UnifiedButton migration..."

# Find all files that import Button from ~/components/ui
FILES=$(grep -rl "import.*Button.*from.*~/components/ui" app/routes app/components --include="*.tsx" 2>/dev/null)

for file in $FILES; do
    echo "Processing: $file"
    
    # Replace import statements
    sed -i 's/import { Button }/import { UnifiedButton }/g' "$file"
    sed -i 's/import { Button,/import { UnifiedButton,/g' "$file"
    sed -i 's/, Button }/, UnifiedButton }/g' "$file"
    sed -i 's/, Button,/, UnifiedButton,/g' "$file"
    
    # Replace Button usage with UnifiedButton (basic cases)
    sed -i 's/<Button /<UnifiedButton /g' "$file"
    sed -i 's/<\/Button>/<\/UnifiedButton>/g' "$file"
    
    # Handle variant mapping (MUI variants to UnifiedButton variants)
    sed -i 's/variant="contained"/variant="primary"/g' "$file"
    sed -i 's/variant="outlined"/variant="outline"/g' "$file"
    sed -i 's/variant="text"/variant="ghost"/g' "$file"
    
    # Handle color prop mapping
    sed -i 's/color="primary"/variant="primary"/g' "$file"
    sed -i 's/color="secondary"/variant="secondary"/g' "$file"
    sed -i 's/color="error"/variant="destructive"/g' "$file"
    sed -i 's/color="success"/variant="success"/g' "$file"
done

echo "Migration complete! Files processed: $(echo "$FILES" | wc -l)"
echo ""
echo "Note: Manual review recommended for:"
echo "- Complex button props (startIcon, endIcon need to become leftIcon, rightIcon)"
echo "- Size mappings (small -> sm, medium -> md, large -> lg)"
echo "- Custom styling that may need adjustment"
