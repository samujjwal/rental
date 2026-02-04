#!/bin/bash

# Fix remaining Button tags that weren't properly migrated
echo "Fixing remaining Button tags..."

FILES="app/routes/disputes.tsx app/routes/become-owner.tsx app/routes/dashboard.owner.calendar.tsx app/routes/settings.profile.tsx app/routes/auth.reset-password.tsx app/routes/auth.forgot-password.tsx app/routes/listings._index.tsx app/routes/reviews.tsx app/routes/search.tsx app/routes/bookings.tsx app/routes/listings.\$id.tsx app/routes/admin/system/power-operations.tsx"

for file in $FILES; do
    if [ -f "$file" ]; then
        echo "Processing: $file"
        
        # Replace opening Button tags
        sed -i 's/<Button /<UnifiedButton /g' "$file"
        sed -i 's/<Button>/<UnifiedButton>/g' "$file"
        
        # Replace closing Button tags
        sed -i 's/<\/Button>/<\/UnifiedButton>/g' "$file"
    fi
done

echo "Remaining Button tags fixed!"
