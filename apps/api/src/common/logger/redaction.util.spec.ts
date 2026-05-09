import { redactString, redactObject, sanitizeLogData, generateCorrelationId, getCorrelationId } from './redaction.util';

/**
 * PRIVATE DATA REDACTION TESTS
 * 
 * These tests validate that sensitive data is properly redacted from logs and responses:
 * - Email addresses
 * - Phone numbers
 * - Payment intent IDs
 * - Stripe customer/account IDs
 * - API keys
 * - JWT tokens
 * - Credit card numbers
 * - Password fields
 * - Secret fields
 * - Other sensitive PII
 * 
 * Business Truth Validated:
 * - Sensitive data is redacted from all log outputs
 * - Redaction patterns cover all common PII formats
 * - Nested objects are recursively redacted
 * - Arrays are properly handled
 * - Sensitive field names are detected and redacted
 * - Correlation IDs are generated for log tracking
 */

describe('Redaction Utility', () => {
  describe('redactString', () => {
    it('should redact email addresses', () => {
      const input = 'Contact user@example.com for support';
      const result = redactString(input);
      expect(result).toContain('[REDACTED_EMAIL]');
      expect(result).not.toContain('user@example.com');
    });

    it('should redact multiple email addresses', () => {
      const input = 'Email user1@example.com and user2@example.com';
      const result = redactString(input);
      expect(result).toMatch(/\[REDACTED_EMAIL\].*\[REDACTED_EMAIL\]/);
    });

    it('should redact US phone numbers', () => {
      const input = 'Call 123-456-7890 for support';
      const result = redactString(input);
      expect(result).toContain('[REDACTED_PHONE]');
      expect(result).not.toContain('123-456-7890');
    });

    it('should redact international phone numbers', () => {
      const input = 'Call +977-9812345678 for support';
      const result = redactString(input);
      expect(result).toContain('[REDACTED_PHONE]');
      expect(result).not.toContain('9812345678');
    });

    it('should redact Stripe payment intent IDs', () => {
      const input = 'Payment intent pi_3abc123def456ghi789jkl012mno345pq';
      const result = redactString(input);
      expect(result).toContain('[REDACTED_PAYMENT_INTENT_ID]');
      expect(result).not.toContain('pi_3abc123def456ghi789jkl012mno345pq');
    });

    it('should redact Stripe customer IDs', () => {
      const input = 'Customer cus_abc123def456ghi789jkl012mno345pq';
      const result = redactString(input);
      expect(result).toContain('[REDACTED_CUSTOMER_ID]');
      expect(result).not.toContain('cus_abc123def456ghi789jkl012mno345pq');
    });

    it('should redact Stripe account IDs', () => {
      const input = 'Account acct_abc123def456ghi789jkl012mno345pq';
      const result = redactString(input);
      expect(result).toContain('[REDACTED_ACCOUNT_ID]');
      expect(result).not.toContain('acct_abc123def456ghi789jkl012mno345pq');
    });

    it('should redact API keys with sk_ prefix', () => {
      const input = 'API key sk_abc123def456ghi789jkl012mno345pqrs';
      const result = redactString(input);
      expect(result).toContain('[REDACTED_API_KEY]');
      expect(result).not.toContain('sk_abc123def456ghi789jkl012mno345pqrs');
    });

    it('should redact API keys with pk_ prefix', () => {
      const input = 'Public key pk_abc123def456ghi789jkl012mno345pqrs';
      const result = redactString(input);
      expect(result).toContain('[REDACTED_API_KEY]');
      expect(result).not.toContain('pk_abc123def456ghi789jkl012mno345pqrs');
    });

    it('should redact JWT tokens', () => {
      const input = 'Token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const result = redactString(input);
      expect(result).toContain('[REDACTED_TOKEN]');
      expect(result).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    });

    it('should redact credit card numbers', () => {
      const input = 'Card 1234-5678-9012-3456';
      const result = redactString(input);
      expect(result).toContain('[REDACTED_CARD]');
      expect(result).not.toContain('1234-5678-9012-3456');
    });

    it('should redact password fields in JSON', () => {
      const input = '{"password":"secret123"}';
      const result = redactString(input);
      expect(result).toContain('"password": "[REDACTED]"');
      expect(result).not.toContain('secret123');
    });

    it('should redact secret fields in JSON', () => {
      const input = '{"secret":"mysecret"}';
      const result = redactString(input);
      expect(result).toContain('"secret": "[REDACTED]"');
      expect(result).not.toContain('mysecret');
    });

    it('should redact apiKey fields in JSON', () => {
      const input = '{"apiKey":"mykey123"}';
      const result = redactString(input);
      expect(result).toContain('"apiKey": "[REDACTED]"');
      expect(result).not.toContain('mykey123');
    });

    it('should handle single-quoted password fields', () => {
      const input = "{'password':'secret123'}";
      const result = redactString(input);
      expect(result).toContain("'password': '[REDACTED]'");
      expect(result).not.toContain('secret123');
    });

    it('should preserve non-sensitive data', () => {
      const input = 'User John Doe booked listing 123';
      const result = redactString(input);
      expect(result).toBe(input);
    });

    it('should handle empty strings', () => {
      const result = redactString('');
      expect(result).toBe('');
    });

    it('should handle strings with no sensitive data', () => {
      const input = 'This is a normal message';
      const result = redactString(input);
      expect(result).toBe(input);
    });
  });

  describe('redactObject', () => {
    it('should redact sensitive field names in objects', () => {
      const input = {
        username: 'john',
        password: 'secret123',
        email: 'john@example.com',
      };
      const result = redactObject(input);
      expect(result.username).toBe('john');
      expect(result.password).toBe('[REDACTED]');
      expect(result.email).toContain('[REDACTED_EMAIL]');
    });

    it('should redact nested sensitive fields', () => {
      const input = {
        user: {
          name: 'John',
          credentials: {
            password: 'secret123',
            apiKey: 'key123',
          },
        },
      };
      const result = redactObject(input);
      expect(result.user.name).toBe('John');
      expect(result.user.credentials.password).toBe('[REDACTED]');
      expect(result.user.credentials.apiKey).toBe('[REDACTED]');
    });

    it('should handle arrays of objects', () => {
      const input = [
        { email: 'user1@example.com', name: 'User 1' },
        { email: 'user2@example.com', name: 'User 2' },
      ];
      const result = redactObject(input);
      expect(result[0].email).toContain('[REDACTED_EMAIL]');
      expect(result[0].name).toBe('User 1');
      expect(result[1].email).toContain('[REDACTED_EMAIL]');
      expect(result[1].name).toBe('User 2');
    });

    it('should preserve primitive values', () => {
      expect(redactObject(123)).toBe(123);
      expect(redactObject(true)).toBe(true);
      expect(redactObject(false)).toBe(false);
    });

    it('should handle null and undefined', () => {
      expect(redactObject(null)).toBe(null);
      expect(redactObject(undefined)).toBe(undefined);
    });

    it('should redact various sensitive field names', () => {
      const input = {
        accessToken: 'token123',
        refreshToken: 'refresh123',
        privateKey: 'key123',
        publicKey: 'pub123',
        authToken: 'auth123',
        sessionToken: 'session123',
        csrfToken: 'csrf123',
        stripeSecret: 'stripe123',
        webhookSecret: 'webhook123',
        jwtSecret: 'jwt123',
        encryptionKey: 'encrypt123',
      };
      const result = redactObject(input);
      Object.values(result).forEach(value => {
        expect(value).toBe('[REDACTED]');
      });
    });

    it('should redact SSN and credit card fields', () => {
      const input = {
        ssn: '123-45-6789',
        socialSecurityNumber: '987-65-4321',
        creditCard: '1234-5678-9012-3456',
        cardNumber: '4321-8765-2109-8765',
        cvc: '123',
        cvv: '456',
        bankAccount: '123456789',
        routingNumber: '987654321',
      };
      const result = redactObject(input);
      Object.values(result).forEach(value => {
        expect(value).toBe('[REDACTED]');
      });
    });

    it('should handle case-insensitive field name matching', () => {
      const input = {
        Password: 'secret123',
        PASSWORD: 'secret456',
        ApiKey: 'key123',
        APIKEY: 'key456',
      };
      const result = redactObject(input);
      Object.values(result).forEach(value => {
        expect(value).toBe('[REDACTED]');
      });
    });

    it('should handle maximum recursion depth', () => {
      const deepObject: any = {};
      let current = deepObject;
      for (let i = 0; i < 15; i++) {
        current.nested = {};
        current = current.nested;
      }
      current.value = 'secret';
      
      const result = redactObject(deepObject);
      expect(result).toBeDefined();
    });

    it('should redact strings within objects', () => {
      const input = {
        message: 'Contact user@example.com for support',
      };
      const result = redactObject(input);
      expect(result.message).toContain('[REDACTED_EMAIL]');
    });
  });

  describe('sanitizeLogData', () => {
    it('should sanitize log data by redacting sensitive information', () => {
      const input = {
        user: 'john@example.com',
        password: 'secret123',
        metadata: {
          apiKey: 'key123',
        },
      };
      const result = sanitizeLogData(input);
      expect(result.user).toContain('[REDACTED_EMAIL]');
      expect(result.password).toBe('[REDACTED]');
      expect(result.metadata.apiKey).toBe('[REDACTED]');
    });

    it('should handle complex nested structures', () => {
      const input = {
        request: {
          headers: {
            authorization: 'Bearer eyJtoken123',
          },
          body: {
            email: 'user@example.com',
            password: 'secret123',
          },
        },
      };
      const result = sanitizeLogData(input);
      expect(result.request.headers.authorization).toContain('[REDACTED_TOKEN]');
      expect(result.request.body.email).toContain('[REDACTED_EMAIL]');
      expect(result.request.body.password).toBe('[REDACTED]');
    });

    it('should handle arrays with sensitive data', () => {
      const input = {
        users: [
          { email: 'user1@example.com', password: 'pass1' },
          { email: 'user2@example.com', password: 'pass2' },
        ],
      };
      const result = sanitizeLogData(input);
      result.users.forEach((user: any) => {
        expect(user.email).toContain('[REDACTED_EMAIL]');
        expect(user.password).toBe('[REDACTED]');
      });
    });
  });

  describe('generateCorrelationId', () => {
    it('should generate a unique correlation ID', () => {
      const id1 = generateCorrelationId();
      const id2 = generateCorrelationId();
      expect(id1).not.toBe(id2);
    });

    it('should generate correlation ID with timestamp', () => {
      const id = generateCorrelationId();
      const timestamp = parseInt(id.split('-')[0]);
      expect(timestamp).toBeGreaterThan(Date.now() - 1000);
      expect(timestamp).toBeLessThanOrEqual(Date.now());
    });

    it('should generate correlation ID with random component', () => {
      const id = generateCorrelationId();
      const parts = id.split('-');
      expect(parts.length).toBe(2);
      expect(parts[1]).toMatch(/^[a-z0-9]+$/);
    });
  });

  describe('getCorrelationId', () => {
    it('should extract correlation ID from x-correlation-id header', () => {
      const headers = {
        'x-correlation-id': 'test-correlation-id-123',
      };
      const result = getCorrelationId(headers);
      expect(result).toBe('test-correlation-id-123');
    });

    it('should extract correlation ID from x-request-id header', () => {
      const headers = {
        'x-request-id': 'request-id-456',
      };
      const result = getCorrelationId(headers);
      expect(result).toBe('request-id-456');
    });

    it('should extract correlation ID from request-id header', () => {
      const headers = {
        'request-id': 'request-id-789',
      };
      const result = getCorrelationId(headers);
      expect(result).toBe('request-id-789');
    });

    it('should prioritize x-correlation-id over other headers', () => {
      const headers = {
        'x-correlation-id': 'priority-id',
        'x-request-id': 'secondary-id',
        'request-id': 'tertiary-id',
      };
      const result = getCorrelationId(headers);
      expect(result).toBe('priority-id');
    });

    it('should generate new correlation ID if none exists', () => {
      const headers = {};
      const result = getCorrelationId(headers);
      expect(result).toBeDefined();
      expect(result).toMatch(/^[0-9]+-[a-z0-9]+$/);
    });

    it('should handle empty headers object', () => {
      const result = getCorrelationId({});
      expect(result).toBeDefined();
    });

    it('should handle null headers', () => {
      const result = getCorrelationId(null as any);
      expect(result).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle mixed case in sensitive field names', () => {
      const input = {
        PassWord: 'secret',
        ApiKey: 'key',
        SECRET: 'value',
      };
      const result = redactObject(input);
      Object.values(result).forEach(value => {
        expect(value).toBe('[REDACTED]');
      });
    });

    it('should handle partial matches in field names', () => {
      const input = {
        userPassword: 'secret',
        myApiKey: 'key',
        tempSecret: 'value',
      };
      const result = redactObject(input);
      Object.values(result).forEach(value => {
        expect(value).toBe('[REDACTED]');
      });
    });

    it('should not redact non-matching field names', () => {
      const input = {
        username: 'john',
        passwordHint: 'hint',
        key: 'value',
      };
      const result = redactObject(input);
      expect(result.username).toBe('john');
      expect(result.passwordHint).toBe('[REDACTED]');
      expect(result.key).toBe('value');
    });

    it('should handle circular references gracefully', () => {
      const obj: any = { a: 1 };
      obj.self = obj;
      const result = redactObject(obj);
      expect(result).toBeDefined();
    });

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000) + ' user@example.com ' + 'b'.repeat(10000);
      const result = redactString(longString);
      expect(result).toContain('[REDACTED_EMAIL]');
      expect(result).not.toContain('user@example.com');
    });

    it('should handle special characters in email', () => {
      const input = 'Email user+tag@example.com or user.name@example.co.uk';
      const result = redactString(input);
      expect(result).toContain('[REDACTED_EMAIL]');
      expect(result).not.toContain('user+tag@example.com');
      expect(result).not.toContain('user.name@example.co.uk');
    });

    it('should handle phone numbers with various separators', () => {
      const input = 'Phone: 123.456.7890 or (123) 456-7890';
      const result = redactString(input);
      expect(result).toContain('[REDACTED_PHONE]');
    });
  });
});
