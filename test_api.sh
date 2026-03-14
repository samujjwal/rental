#!/bin/bash
set -e

OWNER_TOKEN=$(curl -sf -X POST http://localhost:3400/api/auth/dev-login \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@test.com","role":"HOST","secret":"dev-secret-123"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['accessToken'])")

RENTER_TOKEN=$(curl -sf -X POST http://localhost:3400/api/auth/dev-login \
  -H 'Content-Type: application/json' \
  -d '{"email":"renter@test.com","role":"USER","secret":"dev-secret-123"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['accessToken'])")

echo "Got tokens"

# Create booking
BOOKING=$(curl -s -X POST http://localhost:3400/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $RENTER_TOKEN" \
  -d '{"listingId":"cmmod6ya400havqitjzdwo7ud","startDate":"2028-06-01T10:00:00.000Z","endDate":"2028-06-03T10:00:00.000Z"}')

echo "Create booking response: $BOOKING" | head -c 300
echo ""

BOOKING_ID=$(echo "$BOOKING" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id', 'ERROR'))")
echo "Booking ID: $BOOKING_ID"

# approve
curl -sf -X POST "http://localhost:3400/api/bookings/$BOOKING_ID/approve" \
  -H "Authorization: Bearer $OWNER_TOKEN" > /tmp/approve.json
python3 -c "import json; d=json.load(open('/tmp/approve.json')); print('After approve:', d.get('status', 'ERROR'))"

# bypass-confirm
curl -sf -X POST "http://localhost:3400/api/bookings/$BOOKING_ID/bypass-confirm" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $RENTER_TOKEN" \
  -d '{}' > /tmp/bypass.json
python3 -c "import json; d=json.load(open('/tmp/bypass.json')); print('After bypass:', d.get('status', d.get('message', 'ERROR')))"

# get booking detail
curl -sf "http://localhost:3400/api/bookings/$BOOKING_ID" \
  -H "Authorization: Bearer $OWNER_TOKEN" > /tmp/booking.json
python3 -c "
import json
d = json.load(open('/tmp/booking.json'))
print('Status:', d.get('status', 'ERROR'))
print('ownerId:', d.get('ownerId', 'MISSING'))
print('renterId:', d.get('renterId', 'MISSING'))
print('Keys:', sorted(d.keys()))
"

# start
curl -sf -X POST "http://localhost:3400/api/bookings/$BOOKING_ID/start" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -d '{}' > /tmp/start.json
python3 -c "import json; d=json.load(open('/tmp/start.json')); print('After start:', d.get('status', 'ERROR'))"

# request-return
curl -sf -X POST "http://localhost:3400/api/bookings/$BOOKING_ID/request-return" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $RENTER_TOKEN" \
  -d '{}' > /tmp/rr.json
python3 -c "import json; d=json.load(open('/tmp/rr.json')); print('After request-return:', d.get('status', 'ERROR'))"

# final state
curl -sf "http://localhost:3400/api/bookings/$BOOKING_ID" \
  -H "Authorization: Bearer $OWNER_TOKEN" > /tmp/final.json
python3 -c "
import json
d = json.load(open('/tmp/final.json'))
print('FINAL STATUS:', d.get('status', 'ERROR'))
print('FINAL ownerId:', d.get('ownerId', 'MISSING'))
print('FINAL renterId:', d.get('renterId', 'MISSING'))
"
