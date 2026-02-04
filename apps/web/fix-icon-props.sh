#!/bin/bash

# Fix startIcon/endIcon to leftIcon/rightIcon for UnifiedButton
echo "Fixing icon props for UnifiedButton..."

FILES=$(find app -name "*.tsx" -type f -exec grep -l "startIcon\|endIcon" {} \;)

for file in $FILES; do
    echo "Processing: $file"
    
    # Replace startIcon with leftIcon
    sed -i 's/startIcon=/leftIcon=/g' "$file"
    
    # Replace endIcon with rightIcon
    sed -i 's/endIcon=/rightIcon=/g' "$file"
done

echo "Icon prop migration complete!"
