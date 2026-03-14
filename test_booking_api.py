import subprocess, json

def run(cmd):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return r.stdout.strip()

# get tokens
owner_resp = json.loads(run("curl -sf -X POST http://localhost:3400/api/auth/dev-login -H 'Content-Type: application/json' -d '{\"email\":\"owner@test.com\",\"role\":\"HOST\",\"secret\":\"dev-secret-123\"}'"))
renter_resp = json.loads(run("curl -sf -X POST http://localhost:3400/api/auth/dev-login -H 'Content-Type: application/json' -d '{\"email\":\"renter@test.com\",\"role\":\"USER\",\"secret\":\"dev-secret-123\"}'"))

owner_token = owner_resp['accessToken']
renter_token = renter_resp['accessToken']
print(f"Owner ID: {owner_resp['user']['id']}")
print(f"Renter ID: {renter_resp['user']['id']}")

# find listing
listings = json.loads(run(f"curl -sf 'http://localhost:3400/api/listings?limit=5&status=PUBLISHED' -H 'Authorization: Bearer {renter_token}'"))
items = listings.get('data', listings.get('items', listings.get('listings', [])))
listing_id = items[0]['id']
print(f"Listing ID: {listing_id}, Owner: {items[0].get('ownerId', 'N/A')}")

# Create booking
booking_data = json.dumps({"listingId": listing_id, "startDate": "2028-01-01T10:00:00.000Z", "endDate": "2028-01-03T10:00:00.000Z"})
booking = json.loads(run(f"curl -sf -X POST http://localhost:3400/api/bookings -H 'Content-Type: application/json' -H 'Authorization: Bearer {renter_token}' -d '{booking_data}'"))
booking_id = booking.get('id', 'ERROR')
print(f"Booking ID: {booking_id}")
print(f"Booking ownerId: {booking.get('ownerId', 'MISSING')}")
print(f"Booking renterId: {booking.get('renterId', 'MISSING')}")
print(f"Booking status: {booking.get('status', 'ERROR')}")

if booking_id == 'ERROR':
    print("Full response:", json.dumps(booking, indent=2))
    exit(1)

# Advance to AWAITING_RETURN_INSPECTION
# 1. approve (if PENDING_OWNER_APPROVAL)
if booking.get('status') == 'PENDING_OWNER_APPROVAL':
    r = run(f"curl -sf -X POST http://localhost:3400/api/bookings/{booking_id}/approve -H 'Authorization: Bearer {owner_token}'")
    print(f"After approve: {json.loads(r).get('status', 'ERROR')}")

# 2. bypass-confirm
r = run(f"curl -sf -X POST http://localhost:3400/api/bookings/{booking_id}/bypass-confirm -H 'Content-Type: application/json' -H 'Authorization: Bearer {renter_token}' -d '{{}}'")
if r:
    d = json.loads(r)
    print(f"After bypass-confirm: {d.get('status', d.get('message', 'ERROR'))}")

# 3. Check status
r = run(f"curl -sf http://localhost:3400/api/bookings/{booking_id} -H 'Authorization: Bearer {owner_token}'")
d = json.loads(r)
print(f"After bypass-confirm check: {d.get('status', 'ERROR')}")
print(f"  ownerId: {d.get('ownerId', 'MISSING')}")
print(f"  renterId: {d.get('renterId', 'MISSING')}")

if d.get('status') == 'CONFIRMED':
    # 4. start
    r = run(f"curl -sf -X POST http://localhost:3400/api/bookings/{booking_id}/start -H 'Content-Type: application/json' -H 'Authorization: Bearer {owner_token}' -d '{{}}'")
    d2 = json.loads(r)
    print(f"After start: {d2.get('status', 'ERROR')}")
    
    # 5. request-return
    r = run(f"curl -sf -X POST http://localhost:3400/api/bookings/{booking_id}/request-return -H 'Content-Type: application/json' -H 'Authorization: Bearer {renter_token}' -d '{{}}'")
    d3 = json.loads(r)
    print(f"After request-return: {d3.get('status', 'ERROR')}")
    
    # 6. Get final state
    r = run(f"curl -sf http://localhost:3400/api/bookings/{booking_id} -H 'Authorization: Bearer {owner_token}'")
    final = json.loads(r)
    print(f"\nFinal booking state:")
    for k in ['id', 'status', 'ownerId', 'renterId']:
        print(f"  {k}: {final.get(k, 'MISSING')}")
print("Done.")
