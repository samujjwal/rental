# External Services Configuration Guide

This guide provides step-by-step instructions for setting up all external services required by the Rental Portal platform.

## Table of Contents

1. [SendGrid (Email)](#sendgrid-email)
2. [Twilio (SMS)](#twilio-sms)
3. [Firebase (Push Notifications)](#firebase-push-notifications)
4. [OpenAI (Content Moderation)](#openai-content-moderation)
5. [AWS Services](#aws-services)
6. [Testing Configuration](#testing-configuration)

---

## SendGrid (Email)

### Setup Steps

1. **Create SendGrid Account**
   - Go to [sendgrid.com](https://sendgrid.com)
   - Sign up for a free account (100 emails/day)
   - Verify your email address

2. **Create API Key**
   - Navigate to Settings → API Keys
   - Click "Create API Key"
   - Name: `rental-portal-api-key`
   - Permissions: Select "Full Access"
   - Copy the generated API key

3. **Verify Sender Identity**
   - Navigate to Settings → Sender Authentication
   - Choose "Single Sender Verification" (for development)
   - Or "Domain Authentication" (for production)
   - Follow verification steps

4. **Create Email Templates**
   - Navigate to Email API → Dynamic Templates
   - Create templates for:
     - Booking Confirmation
     - Payment Receipt
     - Listing Approved
     - Review Received
     - Message Notification

5. **Environment Variables**
   ```env
   EMAIL_FROM=noreply@yourdomain.com
   SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxx
   ```

### Testing

```bash
# Test email sending
curl -X POST http://localhost:3000/api/test/email \
  -H "Content-Type: application/json" \
  -d '{"to": "test@example.com", "subject": "Test", "body": "Test email"}'
```

---

## Twilio (SMS)

### Setup Steps

1. **Create Twilio Account**
   - Go to [twilio.com](https://www.twilio.com)
   - Sign up for a free trial ($15 credit)
   - Verify your phone number

2. **Get Account Credentials**
   - Navigate to Console Dashboard
   - Copy Account SID and Auth Token

3. **Get Phone Number**
   - Navigate to Phone Numbers → Buy a Number
   - Choose a number with SMS capabilities
   - Purchase the number (free with trial credit)

4. **Configure Messaging Service** (Optional)
   - Navigate to Messaging → Services
   - Create a new Messaging Service
   - Add your phone number to the service
   - Enable "Process inbound messages"

5. **Environment Variables**
   ```env
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=+1234567890
   ```

### Testing

```bash
# Test SMS sending
curl -X POST http://localhost:3000/api/test/sms \
  -H "Content-Type: application/json" \
  -d '{"to": "+1234567890", "message": "Test SMS"}'
```

---

## Firebase (Push Notifications)

### Setup Steps

1. **Create Firebase Project**
   - Go to [console.firebase.google.com](https://console.firebase.google.com)
   - Click "Add project"
   - Name: `rental-portal`
   - Enable Google Analytics (optional)

2. **Enable Cloud Messaging**
   - Navigate to Project Settings → Cloud Messaging
   - Under "Cloud Messaging API (Legacy)", note the Server Key
   - Under "Firebase Cloud Messaging API", enable the API

3. **Generate Service Account**
   - Navigate to Project Settings → Service Accounts
   - Click "Generate new private key"
   - Save the JSON file securely
   - Extract these values:
     - `project_id`
     - `client_email`
     - `private_key`

4. **Configure for Web**
   - Navigate to Project Settings → General
   - Under "Your apps", click "Web"
   - Register your app
   - Copy the Firebase Config

5. **Environment Variables**
   ```env
   FIREBASE_PROJECT_ID=rental-portal
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@rental-portal.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nXXXXX\n-----END PRIVATE KEY-----\n"
   FCM_SERVER_KEY=AAAAxxxxxxxx
   ```

### Testing

```bash
# Register device token
curl -X POST http://localhost:3000/api/notifications/devices/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"token": "device_fcm_token", "platform": "web"}'

# Send test notification
curl -X POST http://localhost:3000/api/test/push \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-123", "title": "Test", "body": "Test notification"}'
```

---

## OpenAI (Content Moderation)

### Setup Steps

1. **Create OpenAI Account**
   - Go to [platform.openai.com](https://platform.openai.com)
   - Sign up for an account
   - Add payment method (required for API access)

2. **Create API Key**
   - Navigate to API Keys section
   - Click "Create new secret key"
   - Name: `rental-portal-moderation`
   - Copy the key (you won't see it again)

3. **Set Usage Limits** (Recommended)
   - Navigate to Usage Limits
   - Set monthly budget cap (e.g., $50)
   - Enable email alerts at 75%, 90%, 100%

4. **Choose Model**
   - For content moderation: `gpt-4` or `gpt-3.5-turbo`
   - Consider using `text-moderation-latest` for explicit content

5. **Environment Variables**
   ```env
   OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
   OPENAI_MODEL=gpt-4
   MODERATION_CONFIDENCE_THRESHOLD=0.75
   ```

### Testing

```bash
# Test text moderation
curl -X POST http://localhost:3000/api/moderation/text \
  -H "Content-Type: application/json" \
  -d '{"text": "This is a test message to moderate"}'
```

---

## AWS Services

### Required Services
- **S3**: File storage (images, documents)
- **Rekognition**: Image moderation
- **Textract**: Document verification (insurance policies)

### Setup Steps

1. **Create AWS Account**
   - Go to [aws.amazon.com](https://aws.amazon.com)
   - Sign up (requires credit card, free tier available)

2. **Create IAM User**
   - Navigate to IAM → Users
   - Click "Add User"
   - User name: `rental-portal-service`
   - Access type: Programmatic access
   - Attach policies:
     - `AmazonS3FullAccess`
     - `AmazonRekognitionFullAccess`
     - `AmazonTextractFullAccess`
   - Save Access Key ID and Secret Access Key

3. **Create S3 Bucket**
   - Navigate to S3 → Create Bucket
   - Bucket name: `rental-portal-uploads`
   - Region: `us-east-1` (or your preferred region)
   - Block public access: Keep default settings
   - Enable versioning (optional)
   - Configure CORS:
     ```json
     [
       {
         "AllowedHeaders": ["*"],
         "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
         "AllowedOrigins": ["http://localhost:5173", "https://yourdomain.com"],
         "ExposeHeaders": ["ETag"]
       }
     ]
     ```

4. **Enable Rekognition**
   - No additional setup required
   - Pay-per-use pricing
   - Free tier: 5,000 images/month for first 12 months

5. **Enable Textract**
   - No additional setup required
   - Pay-per-use pricing
   - Free tier: 1,000 pages/month for first 3 months

6. **Environment Variables**
   ```env
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
   AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   AWS_S3_BUCKET=rental-portal-uploads
   AWS_REKOGNITION_MIN_CONFIDENCE=80
   AWS_TEXTRACT_ENABLED=true
   ```

### Testing

```bash
# Test S3 upload
curl -X POST http://localhost:3000/api/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/test-image.jpg"

# Test image moderation
curl -X POST http://localhost:3000/api/moderation/image \
  -H "Content-Type: application/json" \
  -d '{"imageUrl": "https://rental-portal-uploads.s3.amazonaws.com/test.jpg"}'
```

---

## Testing Configuration

### Verify All Services

Create a test script to verify all integrations:

```bash
cd apps/api
npm run test:services
```

Or manually test each service:

```bash
# 1. Email
curl -X POST http://localhost:3000/api/test/email

# 2. SMS
curl -X POST http://localhost:3000/api/test/sms

# 3. Push Notifications
curl -X POST http://localhost:3000/api/test/push

# 4. Content Moderation
curl -X POST http://localhost:3000/api/test/moderation

# 5. AWS S3
curl -X POST http://localhost:3000/api/test/upload
```

### Development vs Production

**Development:**
- Use free tiers and trial accounts
- Test with dummy data
- Enable verbose logging
- Use localhost URLs

**Production:**
- Upgrade to paid plans with appropriate limits
- Use production domains
- Enable monitoring and alerts
- Rotate API keys regularly
- Set up backup services

### Cost Estimates (Monthly)

- **SendGrid**: Free (100/day) or $15/month (40,000 emails)
- **Twilio**: ~$1/1000 SMS messages
- **Firebase**: Free (unlimited messages), $25/month for analytics
- **OpenAI**: ~$0.002/request (GPT-4), ~$10-50/month typical
- **AWS**:
  - S3: ~$0.023/GB storage, ~$0.09/GB transfer
  - Rekognition: $1.00/1000 images
  - Textract: $1.50/1000 pages

**Estimated Total**: $50-150/month for moderate usage

---

## Environment Variables Checklist

```env
# ✓ Core Services
DATABASE_URL=
REDIS_HOST=
REDIS_PORT=

# ✓ Email
SENDGRID_API_KEY=
EMAIL_FROM=

# ✓ SMS
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# ✓ Push Notifications
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FCM_SERVER_KEY=

# ✓ Content Moderation
OPENAI_API_KEY=
OPENAI_MODEL=

# ✓ AWS
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=
```

---

## Troubleshooting

### Common Issues

1. **SendGrid emails not sending**
   - Verify sender identity
   - Check API key permissions
   - Review activity feed in SendGrid dashboard

2. **Twilio SMS failing**
   - Verify phone number is SMS-enabled
   - Check recipient number format (+1234567890)
   - Trial accounts can only send to verified numbers

3. **Firebase push notifications not received**
   - Verify device token is registered
   - Check Firebase Console → Cloud Messaging logs
   - Ensure FCM server key is correct

4. **OpenAI rate limits**
   - Implement request caching
   - Use exponential backoff
   - Monitor usage in OpenAI dashboard

5. **AWS permissions errors**
   - Verify IAM user has correct policies
   - Check bucket name and region
   - Review CloudWatch logs

### Support Resources

- **SendGrid**: [support.sendgrid.com](https://support.sendgrid.com)
- **Twilio**: [support.twilio.com](https://support.twilio.com)
- **Firebase**: [firebase.google.com/support](https://firebase.google.com/support)
- **OpenAI**: [help.openai.com](https://help.openai.com)
- **AWS**: [aws.amazon.com/support](https://aws.amazon.com/support)

---

## Next Steps

After configuring all services:

1. ✅ Update `.env` file with all API keys
2. ✅ Test each service independently
3. ✅ Run integration tests
4. ✅ Set up monitoring and alerts
5. ✅ Document service limits and quotas
6. ✅ Configure backup/fallback services
7. ✅ Schedule regular security audits

## Security Best Practices

- Never commit API keys to version control
- Rotate keys every 90 days
- Use separate keys for dev/staging/production
- Enable 2FA on all service accounts
- Monitor usage for anomalies
- Set up billing alerts
- Store keys in secure secret management (AWS Secrets Manager, HashiCorp Vault)
