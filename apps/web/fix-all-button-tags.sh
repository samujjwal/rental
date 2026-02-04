#!/bin/bash

# Comprehensive fix for all remaining Button/UnifiedButton mismatches
echo "Fixing all remaining Button tag issues..."

# Find all files with Button tags (excluding UnifiedButton, IconButton)
FILES=$(grep -rl "<Button" app --include="*.tsx" | grep -v "unified-button" | grep -v ".test.tsx")

for file in $FILES; do
    echo "Processing: $file"
    
    # Check if file has mismatched tags
    if grep -q "</UnifiedButton>" "$file" && grep -q "<Button" "$file"; then
        echo "  -> Found mismatched tags, fixing..."
        
        # Replace all Button opening tags with UnifiedButton
        sed -i 's/<Button /<UnifiedButton /g' "$file"
        sed -i 's/<Button>/<UnifiedButton>/g' "$file"
        
        # Fix MUI-specific props
        sed -i 's/variant="contained"/variant="primary"/g' "$file"
        sed -i 's/variant="outlined"/variant="outline"/g' "$file"
        sed -i 's/variant="text"/variant="ghost"/g' "$file"
        sed -i 's/color="error"/variant="destructive"/g' "$file"
        sed -i 's/color="primary"//g' "$file"
        sed -i 's/color="secondary"//g' "$file"
        
        # Remove duplicate variant props (keep last one)
        sed -i ':a;N;$!ba;s/variant="[^"]*"\([^>]*\)variant="/variant="/g' "$file"
    fi
done

echo "All Button tags fixed!"
echo "Files processed: $(echo "$FILES" | wc -l)"
