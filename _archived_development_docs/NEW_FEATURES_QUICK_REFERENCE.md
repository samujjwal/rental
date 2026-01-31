# New Features Quick Reference Guide

## Organizations/Multi-tenancy API

### Create Organization
```bash
POST /api/organizations
Authorization: Bearer {token}

{
  "name": "Pro Rentals LLC",
  "description": "Professional equipment rental company",
  "businessType": "LLC",
  "taxId": "12-3456789",
  "email": "contact@prorentals.com",
  "phoneNumber": "+1234567890",
  "addressLine1": "123 Main St",
  "city": "San Francisco",
  "state": "CA",
  "postalCode": "94102",
  "country": "US"
}
```

### Invite Team Member
```bash
POST /api/organizations/{orgId}/members

{
  "email": "manager@example.com",
  "role": "MANAGER"  // OWNER, ADMIN, MANAGER, MEMBER
}
```

### Get Organization Stats
```bash
GET /api/organizations/{orgId}/stats

Response:
{
  "totalListings": 25,
  "activeListings": 20,
  "totalBookings": 150,
  "totalRevenue": 45000
}
```

---

## Fraud Detection Integration

### Check User Risk Before Booking
```typescript
import { FraudDetectionService } from '@/modules/fraud-detection/services/fraud-detection.service';

// In booking service
const fraudCheck = await this.fraudDetectionService.checkUserRisk(userId);

if (!fraudCheck.allowBooking) {
  throw new ForbiddenException('Your account requires verification before booking');
}

if (fraudCheck.requiresManualReview) {
  // Flag for admin review
  await this.flagForReview(bookingId, fraudCheck);
}
```

### Check Booking Risk
```typescript
const bookingRisk = await this.fraudDetectionService.checkBookingRisk({
  userId,
  listingId,
  totalPrice: 500,
  startDate: new Date('2026-02-01'),
  endDate: new Date('2026-02-05')
});

console.log('Risk Level:', bookingRisk.riskLevel); // LOW, MEDIUM, HIGH, CRITICAL
console.log('Risk Score:', bookingRisk.riskScore); // 0-100
console.log('Flags:', bookingRisk.flags); // Array of fraud indicators
```

### Fraud Flags Reference
- `NEW_ACCOUNT` - Account <7 days old
- `EMAIL_NOT_VERIFIED` - Email not confirmed
- `ID_NOT_VERIFIED` - Government ID not verified
- `FREQUENT_CANCELLATIONS` - >2 cancellations in 90 days
- `DISPUTE_HISTORY` - Multiple disputes
- `LOW_RATING` - Average rating <3.5
- `NEGATIVE_REVIEWS` - Many reviews below 3 stars
- `HIGH_BOOKING_VELOCITY` - >3 booking attempts in 60min
- `HIGH_VALUE_NEW_USER` - >$500 booking, account <30 days
- `FIRST_HIGH_VALUE_BOOKING` - First booking >$300
- `UNUSUALLY_LONG_BOOKING` - Duration >90 days
- `LAST_MINUTE_BOOKING` - Starts in <2 hours
- `SUSPICIOUSLY_LOW_PRICE` - 70% below category average
- `SUSPICIOUS_CONTENT` - Spam patterns detected

---

## Tax Calculation Integration

### Calculate Tax for Booking
```typescript
import { TaxCalculationService } from '@/modules/tax/services/tax-calculation.service';

const taxBreakdown = await this.taxService.calculateTax({
  amount: 1000, // Subtotal
  currency: 'USD',
  listingId: 'listing-123',
  country: 'US',
  state: 'CA',
  city: 'San Francisco',
  categoryId: 'spaces'
});

console.log(taxBreakdown);
// {
//   subtotal: 1000,
//   taxLines: [
//     { type: 'SALES_TAX', name: 'State Sales Tax', rate: 7.25, amount: 72.50, jurisdiction: 'California' },
//     { type: 'LOCAL_TAX', name: 'Local Tax', rate: 0.5, amount: 5.00, jurisdiction: 'San Francisco' },
//     { type: 'LODGING_TAX', name: 'TOT', rate: 14.0, amount: 140.00, jurisdiction: 'California' }
//   ],
//   totalTax: 217.50,
//   total: 1217.50,
//   currency: 'USD'
// }
```

### Generate Tax Receipt
```typescript
const receipt = await this.taxService.generateTaxReceipt(bookingId);

// Returns invoice data with:
// - Invoice number
// - Seller & buyer information
// - Line items
// - Tax breakdown
// - Total amount
```

### Generate 1099 for Owner (US)
```typescript
const form1099 = await this.taxService.generate1099Data(ownerId, 2026);

if (form1099) {
  // Owner earned >$600, issue 1099-MISC
  // Send to owner for tax filing
}
```

### Get User Tax Summary
```typescript
const summary = await this.taxService.getUserTaxSummary(userId, 2026);

console.log(summary);
// {
//   year: 2026,
//   rentalIncome: {
//     gross: 50000,
//     platformFees: 5000,
//     net: 45000
//   },
//   rentalExpenses: {
//     serviceFees: 1500
//   },
//   taxDocuments: {
//     form1099Available: true
//   }
// }
```

### Supported Tax Jurisdictions
```
US:
  - California (Sales Tax: 7.25%, TOT: 14%)
  - New York (Sales Tax: 4% + NYC 4.5%, Hotel Tax: 5.875%)
  - Texas (Sales Tax: 6.25%)

EU:
  - United Kingdom (VAT: 20%)
  - Germany (VAT: 19%)
  - France (VAT: 20%)

Canada:
  - Ontario (HST: 13%)
  - British Columbia (GST: 5%, PST: 7%)

Australia:
  - Federal (GST: 10%)
```

---

## Admin Portal Routes

### Access Admin Dashboard
```
URL: /admin
Protected: Requires admin role

Features:
- Key metrics (users, listings, bookings, revenue)
- System health (API, DB, Redis, Elasticsearch)
- Recent bookings
- Open disputes
```

### Manage Dispute
```
URL: /admin/disputes/{disputeId}

Actions:
- View full details and evidence
- Add responses
- Update status (OPEN → UNDER_REVIEW → RESOLVED/CLOSED)
- Set resolution amount
- View timeline
```

### Admin API Endpoints (Backend)
```bash
# Get platform statistics
GET /api/admin/stats
Authorization: Bearer {admin-token}

Response:
{
  "totalUsers": 10000,
  "userGrowth": 5.2,
  "activeListings": 5000,
  "listingGrowth": 3.8,
  "totalBookings": 25000,
  "bookingGrowth": 12.5,
  "revenue30d": 150000,
  "revenueGrowth": 8.3
}

# Get recent bookings
GET /api/admin/bookings/recent?limit=10

# Get open disputes
GET /api/admin/disputes?status=OPEN&limit=5

# Update dispute
PUT /api/admin/disputes/{disputeId}
{
  "status": "RESOLVED",
  "resolution": "Refund issued to renter",
  "resolvedAmount": 250.00
}
```

---

## Integration Checklist

### For Bookings Module
```typescript
// Add to booking creation flow

// 1. Check fraud risk
const fraudCheck = await this.fraudDetectionService.checkBookingRisk({
  userId,
  listingId,
  totalPrice,
  startDate,
  endDate
});

if (!fraudCheck.allowBooking) {
  throw new ForbiddenException('Booking blocked due to risk factors');
}

// 2. Calculate tax
const taxBreakdown = await this.taxService.calculateTax({
  amount: subtotal,
  currency,
  listingId,
  country,
  state,
  city
});

// 3. Create booking with tax
const booking = await this.prisma.booking.create({
  data: {
    // ... other fields
    subtotal,
    taxAmount: taxBreakdown.totalTax,
    totalPrice: taxBreakdown.total,
    taxBreakdown: taxBreakdown.taxLines, // Store for receipt
    riskScore: fraudCheck.riskScore,
    riskFlags: fraudCheck.flags
  }
});

// 4. Log fraud check
await this.fraudDetectionService.logFraudCheck(
  'BOOKING',
  booking.id,
  fraudCheck
);
```

### For Listings Module
```typescript
// Add to listing creation

// Check for fraud indicators
const fraudCheck = await this.fraudDetectionService.checkListingRisk({
  userId,
  title,
  description,
  basePrice,
  photos
});

if (fraudCheck.requiresManualReview) {
  // Set listing status to PENDING_REVIEW
  listing.status = 'PENDING_REVIEW';
  listing.reviewReason = 'Fraud check flagged for review';
}
```

### For Payments Module
```typescript
// Add to payment processing

// Check payment fraud
const paymentRisk = await this.fraudDetectionService.checkPaymentRisk({
  userId,
  paymentMethodId,
  amount
});

if (paymentRisk.requiresManualReview) {
  // Require additional verification (3D Secure)
  paymentIntent.requiresAction = true;
}
```

---

## Environment Variables

Add these to `.env`:

```bash
# Fraud Detection
FRAUD_DETECTION_ENABLED=true
FRAUD_HIGH_RISK_THRESHOLD=50
FRAUD_CRITICAL_RISK_THRESHOLD=70

# Tax Calculation
TAX_CALCULATION_ENABLED=true
COMPANY_TAX_ID=12-3456789
TAX_API_PROVIDER=stripe_tax  # or 'avalara' or 'taxjar'
TAX_API_KEY=sk_tax_...

# Organizations
ORGANIZATIONS_ENABLED=true
MAX_MEMBERS_PER_ORG=50

# Admin Portal
ADMIN_EMAIL=admin@rentalportal.com
ADMIN_DASHBOARD_ENABLED=true
```

---

## Database Migrations Needed

Run these Prisma migrations:

```bash
# Add organization fields to listings
npx prisma migrate dev --name add_organization_to_listings

# Add fraud detection fields to bookings
npx prisma migrate dev --name add_fraud_fields_to_bookings

# Add tax fields to bookings
npx prisma migrate dev --name add_tax_fields_to_bookings
```

---

## Testing

### Test Fraud Detection
```typescript
// tests/fraud-detection.spec.ts

describe('Fraud Detection', () => {
  it('should flag new user with high-value booking', async () => {
    const result = await fraudService.checkBookingRisk({
      userId: newUserId,
      listingId,
      totalPrice: 1000,
      startDate: tomorrow,
      endDate: dayAfterTomorrow
    });

    expect(result.riskLevel).toBe('HIGH');
    expect(result.flags).toContainEqual(
      expect.objectContaining({ type: 'HIGH_VALUE_NEW_USER' })
    );
  });
});
```

### Test Tax Calculation
```typescript
// tests/tax-calculation.spec.ts

describe('Tax Calculation', () => {
  it('should calculate California taxes correctly', async () => {
    const result = await taxService.calculateTax({
      amount: 1000,
      currency: 'USD',
      listingId,
      country: 'US',
      state: 'CA'
    });

    expect(result.totalTax).toBeGreaterThan(70); // 7.25% minimum
    expect(result.taxLines).toHaveLength(1); // At least state tax
  });
});
```

### Test Organizations
```typescript
// tests/organizations.spec.ts

describe('Organizations', () => {
  it('should create organization and add owner as member', async () => {
    const org = await orgService.createOrganization(userId, {
      name: 'Test Org',
      businessType: 'LLC',
      email: 'test@org.com'
    });

    expect(org.ownerId).toBe(userId);
    expect(org.members).toHaveLength(1);
    expect(org.members[0].role).toBe('OWNER');
  });
});
```

---

## Monitoring & Alerts

### Fraud Detection Metrics
```typescript
// Monitor these metrics in Grafana

- fraud_checks_total (counter)
- fraud_risk_score (histogram)
- fraud_flags_by_type (counter)
- bookings_blocked_by_fraud (counter)
- manual_reviews_queued (gauge)
```

### Tax Calculation Metrics
```typescript
- tax_calculations_total (counter)
- tax_calculation_errors (counter)
- average_tax_rate_by_jurisdiction (gauge)
- 1099_forms_generated (counter)
```

### Organization Metrics
```typescript
- organizations_created (counter)
- organization_members_total (gauge)
- organization_listings_total (gauge)
```

### Alert Rules
```yaml
# Alert if fraud detection error rate >5%
- alert: HighFraudDetectionErrorRate
  expr: rate(fraud_detection_errors[5m]) > 0.05
  severity: warning

# Alert if tax calculation fails
- alert: TaxCalculationFailure
  expr: rate(tax_calculation_errors[5m]) > 0.01
  severity: critical

# Alert if admin dashboard unreachable
- alert: AdminDashboardDown
  expr: up{job="admin-portal"} == 0
  severity: critical
```

---

## Production Deployment Steps

1. **Deploy Backend Services**
```bash
# Deploy fraud detection
kubectl apply -f k8s/fraud-detection-service.yaml

# Deploy tax service
kubectl apply -f k8s/tax-service.yaml

# Deploy organizations service
kubectl apply -f k8s/organizations-service.yaml
```

2. **Run Database Migrations**
```bash
npm run prisma:migrate:deploy
```

3. **Update Environment Variables**
```bash
# In AWS Parameter Store / Secrets Manager
- FRAUD_DETECTION_ENABLED=true
- TAX_CALCULATION_ENABLED=true
- ORGANIZATIONS_ENABLED=true
```

4. **Deploy Frontend**
```bash
# Deploy admin portal routes
npm run build
npm run deploy:production
```

5. **Smoke Tests**
```bash
# Test fraud detection
curl -X POST https://api.rentalportal.com/test/fraud-check

# Test tax calculation
curl -X POST https://api.rentalportal.com/test/tax-calculate

# Test admin dashboard
curl https://rentalportal.com/admin
```

---

## Support & Troubleshooting

### Common Issues

**Fraud Detection false positives:**
- Review risk thresholds in environment variables
- Check `fraud_flags_by_type` metric
- Adjust scoring weights if needed

**Tax calculation errors:**
- Verify jurisdiction codes match database
- Check if listing has proper location data
- Ensure tax rates are up to date

**Organization permissions:**
- Verify user has correct role
- Check organization membership table
- Review audit logs for permission changes

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug
DEBUG_FRAUD_DETECTION=true
DEBUG_TAX_CALCULATION=true
```

---

*Quick Reference Guide v1.0 - January 23, 2026*
