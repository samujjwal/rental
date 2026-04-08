import { Test, TestingModule } from '@nestjs/testing';
import { SecurityTestFramework } from './security-framework';
import { SecurityTestUtils } from './security-test-utils';

describe('XSS Security Tests', () => {
  let framework: SecurityTestFramework;
  let securityUtils: SecurityTestUtils;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecurityTestFramework,
        SecurityTestUtils,
      ],
    }).compile();

    framework = module.get<SecurityTestFramework>(SecurityTestFramework);
    securityUtils = module.get<SecurityTestUtils>(SecurityTestUtils);
  });

  describe('XSS in User Inputs', () => {
    test('should block XSS in user registration data', async () => {
      const xssPayloads = [
        {
          email: "test@example.com",
          password: "password123",
          firstName: "<script>alert('XSS')</script>",
          lastName: "Test User"
        },
        {
          email: "test@example.com",
          password: "password123",
          firstName: "Test",
          lastName: "<img src=x onerror=alert('XSS')>"
        },
        {
          email: "test@example.com",
          password: "password123",
          firstName: "Test",
          lastName: "<svg onload=alert('XSS')>"
        },
        {
          email: "test@example.com",
          password: "password123",
          firstName: "<iframe src=javascript:alert('XSS')>",
          lastName: "User"
        },
        {
          email: "test@example.com",
          password: "password123",
          firstName: "<body onload=alert('XSS')>",
          lastName: "User"
        },
        {
          email: "test@example.com",
          password: "password123",
          firstName: "<div onclick=alert('XSS')>Click me</div>",
          lastName: "User"
        },
        {
          email: "test@example.com",
          password: "password123",
          firstName: "<a href=javascript:alert('XSS')>Link</a>",
          lastName: "User"
        },
        {
          email: "test@example.com",
          password: "password123",
          firstName: "<meta http-equiv=refresh content=0;url=javascript:alert('XSS')>",
          lastName: "User"
        }
      ];

      for (const payload of xssPayloads) {
        const response = await framework.testEndpoint({
          method: 'POST',
          path: '/api/auth/register',
          body: payload
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid input data');
        
        // Ensure XSS payload is not reflected in response
        const responseText = JSON.stringify(response.body);
        expect(responseText).not.toContain('<script>');
        expect(responseText).not.toContain('alert(');
        expect(responseText).not.toContain('onerror');
        expect(responseText).not.toContain('onload');
      }
    });

    test('should block XSS in listing creation data', async () => {
      const xssPayloads = [
        {
          title: "<script>alert('XSS')</script>",
          description: "Test description",
          price: 100,
          categoryId: 1
        },
        {
          title: "Test Listing",
          description: "<img src=x onerror=alert('XSS')>",
          price: 100,
          categoryId: 1
        },
        {
          title: "Test Listing",
          description: "Test <svg onload=alert('XSS')> description",
          price: 100,
          categoryId: 1
        },
        {
          title: "<iframe src=javascript:alert('XSS')>",
          description: "Test description",
          price: 100,
          categoryId: 1
        },
        {
          title: "Test Listing",
          description: "<body onload=alert('XSS')>Test",
          price: 100,
          categoryId: 1
        },
        {
          title: "<div onclick=alert('XSS')>Click me</div>",
          description: "Test description",
          price: 100,
          categoryId: 1
        },
        {
          title: "Test Listing",
          description: "<a href=javascript:alert('XSS')>Link</a>",
          price: 100,
          categoryId: 1
        },
        {
          title: "Test Listing",
          description: "<meta http-equiv=refresh content=0;url=javascript:alert('XSS')>",
          price: 100,
          categoryId: 1
        }
      ];

      for (const payload of xssPayloads) {
        const response = await framework.testEndpoint({
          method: 'POST',
          path: '/api/listings',
          body: payload,
          headers: { 'Authorization': 'Bearer test-token' }
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid listing data');
        
        // Ensure XSS payload is not reflected in response
        const responseText = JSON.stringify(response.body);
        expect(responseText).not.toContain('<script>');
        expect(responseText).not.toContain('alert(');
        expect(responseText).not.toContain('onerror');
        expect(responseText).not.toContain('onload');
      }
    });

    test('should block XSS in message content', async () => {
      const xssPayloads = [
        {
          recipientId: "user-123",
          content: "<script>alert('XSS')</script>"
        },
        {
          recipientId: "user-123",
          content: "<img src=x onerror=alert('XSS')>"
        },
        {
          recipientId: "user-123",
          content: "<svg onload=alert('XSS')>"
        },
        {
          recipientId: "user-123",
          content: "<iframe src=javascript:alert('XSS')>"
        },
        {
          recipientId: "user-123",
          content: "<body onload=alert('XSS')>"
        },
        {
          recipientId: "user-123",
          content: "<div onclick=alert('XSS')>Click me</div>"
        },
        {
          recipientId: "user-123",
          content: "<a href=javascript:alert('XSS')>Link</a>"
        },
        {
          recipientId: "user-123",
          content: "<meta http-equiv=refresh content=0;url=javascript:alert('XSS')>"
        }
      ];

      for (const payload of xssPayloads) {
        const response = await framework.testEndpoint({
          method: 'POST',
          path: '/api/messages',
          body: payload,
          headers: { 'Authorization': 'Bearer test-token' }
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid message data');
        
        // Ensure XSS payload is not reflected in response
        const responseText = JSON.stringify(response.body);
        expect(responseText).not.toContain('<script>');
        expect(responseText).not.toContain('alert(');
        expect(responseText).not.toContain('onerror');
        expect(responseText).not.toContain('onload');
      }
    });

    test('should block XSS in review content', async () => {
      const xssPayloads = [
        {
          listingId: "listing-123",
          rating: 5,
          comment: "<script>alert('XSS')</script>"
        },
        {
          listingId: "listing-123",
          rating: 5,
          comment: "<img src=x onerror=alert('XSS')>"
        },
        {
          listingId: "listing-123",
          rating: 5,
          comment: "<svg onload=alert('XSS')>"
        },
        {
          listingId: "listing-123",
          rating: 5,
          comment: "<iframe src=javascript:alert('XSS')>"
        },
        {
          listingId: "listing-123",
          rating: 5,
          comment: "<body onload=alert('XSS')>"
        },
        {
          listingId: "listing-123",
          rating: 5,
          comment: "<div onclick=alert('XSS')>Click me</div>"
        },
        {
          listingId: "listing-123",
          rating: 5,
          comment: "<a href=javascript:alert('XSS')>Link</a>"
        },
        {
          listingId: "listing-123",
          rating: 5,
          comment: "<meta http-equiv=refresh content=0;url=javascript:alert('XSS')>"
        }
      ];

      for (const payload of xssPayloads) {
        const response = await framework.testEndpoint({
          method: 'POST',
          path: '/api/reviews',
          body: payload,
          headers: { 'Authorization': 'Bearer test-token' }
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid review data');
        
        // Ensure XSS payload is not reflected in response
        const responseText = JSON.stringify(response.body);
        expect(responseText).not.toContain('<script>');
        expect(responseText).not.toContain('alert(');
        expect(responseText).not.toContain('onerror');
        expect(responseText).not.toContain('onload');
      }
    });
  });

  describe('XSS in File Uploads', () => {
    test('should block XSS in file names', async () => {
      const maliciousFiles = [
        {
          name: "<script>alert('XSS')</script>.jpg",
          type: "image/jpeg",
          size: 1024
        },
        {
          name: "<img src=x onerror=alert('XSS')>.png",
          type: "image/png",
          size: 1024
        },
        {
          name: "<svg onload=alert('XSS')>.svg",
          type: "image/svg+xml",
          size: 1024
        },
        {
          name: "<iframe src=javascript:alert('XSS')>.html",
          type: "text/html",
          size: 1024
        },
        {
          name: "<body onload=alert('XSS')>.js",
          type: "application/javascript",
          size: 1024
        }
      ];

      for (const file of maliciousFiles) {
        const response = await framework.testEndpoint({
          method: 'POST',
          path: '/api/upload',
          body: { file },
          headers: { 'Authorization': 'Bearer test-token' }
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid file name');
        
        // Ensure XSS payload is not reflected in response
        const responseText = JSON.stringify(response.body);
        expect(responseText).not.toContain('<script>');
        expect(responseText).not.toContain('alert(');
        expect(responseText).not.toContain('onerror');
        expect(responseText).not.toContain('onload');
      }
    });

    test('should block XSS in file metadata', async () => {
      const maliciousMetadata = [
        {
          name: "image.jpg",
          type: "image/jpeg",
          size: 1024,
          description: "<script>alert('XSS')</script>"
        },
        {
          name: "image.jpg",
          type: "image/jpeg",
          size: 1024,
          alt: "<img src=x onerror=alert('XSS')>"
        },
        {
          name: "image.jpg",
          type: "image/jpeg",
          size: 1024,
          title: "<svg onload=alert('XSS')>"
        },
        {
          name: "image.jpg",
          type: "image/jpeg",
          size: 1024,
          caption: "<iframe src=javascript:alert('XSS')>"
        },
        {
          name: "image.jpg",
          type: "image/jpeg",
          size: 1024,
          tags: ["<body onload=alert('XSS')>"]
        }
      ];

      for (const metadata of maliciousMetadata) {
        const response = await framework.testEndpoint({
          method: 'POST',
          path: '/api/upload',
          body: { file: metadata },
          headers: { 'Authorization': 'Bearer test-token' }
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid file metadata');
        
        // Ensure XSS payload is not reflected in response
        const responseText = JSON.stringify(response.body);
        expect(responseText).not.toContain('<script>');
        expect(responseText).not.toContain('alert(');
        expect(responseText).not.toContain('onerror');
        expect(responseText).not.toContain('onload');
      }
    });

    test('should block malicious file content', async () => {
      const maliciousFiles = [
        {
          name: "image.jpg",
          type: "image/jpeg",
          size: 1024,
          content: "<script>alert('XSS')</script>"
        },
        {
          name: "image.png",
          type: "image/png",
          size: 1024,
          content: "<img src=x onerror=alert('XSS')>"
        },
        {
          name: "document.pdf",
          type: "application/pdf",
          size: 1024,
          content: "<svg onload=alert('XSS')>"
        },
        {
          name: "data.json",
          type: "application/json",
          size: 1024,
          content: "<iframe src=javascript:alert('XSS')>"
        }
      ];

      for (const file of maliciousFiles) {
        const response = await framework.testEndpoint({
          method: 'POST',
          path: '/api/upload',
          body: { file },
          headers: { 'Authorization': 'Bearer test-token' }
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Malicious file content');
      }
    });
  });

  describe('XSS in API Responses', () => {
    test('should sanitize XSS in user profile responses', async () => {
      // Create user with XSS in profile
      const userWithXss = {
        email: "test@example.com",
        password: "password123",
        firstName: "<script>alert('XSS')</script>",
        lastName: "Test User",
        bio: "<img src=x onerror=alert('XSS')>"
      };

      // Mock user creation
      await framework.createUser(userWithXss);

      // Get user profile
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/users/profile',
        headers: { 'Authorization': 'Bearer test-token' }
      });

      expect(response.status).toBe(200);
      
      // Ensure XSS is sanitized in response
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('<script>');
      expect(responseText).not.toContain('alert(');
      expect(responseText).not.toContain('onerror');
      expect(responseText).not.toContain('onload');
      
      // Should contain sanitized content
      expect(responseText).toContain('&lt;script&gt;');
      expect(responseText).toContain('&lt;img');
    });

    test('should sanitize XSS in listing responses', async () => {
      // Create listing with XSS
      const listingWithXss = {
        title: "<script>alert('XSS')</script>",
        description: "<img src=x onerror=alert('XSS')>",
        price: 100,
        categoryId: 1
      };

      // Mock listing creation
      await framework.createListing(listingWithXss);

      // Get listing
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/listings/listing-123'
      });

      expect(response.status).toBe(200);
      
      // Ensure XSS is sanitized in response
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('<script>');
      expect(responseText).not.toContain('alert(');
      expect(responseText).not.toContain('onerror');
      expect(responseText).not.toContain('onload');
      
      // Should contain sanitized content
      expect(responseText).toContain('&lt;script&gt;');
      expect(responseText).toContain('&lt;img');
    });

    test('should sanitize XSS in message responses', async () => {
      // Create message with XSS
      const messageWithXss = {
        recipientId: "user-123",
        content: "<script>alert('XSS')</script>"
      };

      // Mock message creation
      await framework.createMessage(messageWithXss);

      // Get messages
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/messages',
        headers: { 'Authorization': 'Bearer test-token' }
      });

      expect(response.status).toBe(200);
      
      // Ensure XSS is sanitized in response
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('<script>');
      expect(responseText).not.toContain('alert(');
      
      // Should contain sanitized content
      expect(responseText).toContain('&lt;script&gt;');
    });

    test('should sanitize XSS in review responses', async () => {
      // Create review with XSS
      const reviewWithXss = {
        listingId: "listing-123",
        rating: 5,
        comment: "<script>alert('XSS')</script>"
      };

      // Mock review creation
      await framework.createReview(reviewWithXss);

      // Get reviews
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/reviews/listing-123'
      });

      expect(response.status).toBe(200);
      
      // Ensure XSS is sanitized in response
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('<script>');
      expect(responseText).not.toContain('alert(');
      
      // Should contain sanitized content
      expect(responseText).toContain('&lt;script&gt;');
    });
  });

  describe('Content Security Policy', () => {
    test('should enforce CSP headers', async () => {
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/users/profile',
        headers: { 'Authorization': 'Bearer test-token' }
      });

      expect(response.status).toBe(200);
      expect(response.headers['content-security-policy']).toBeDefined();
      
      const csp = response.headers['content-security-policy'];
      
      // Should have restrictive CSP
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("upgrade-insecure-requests");
    });

    test('should block inline scripts', async () => {
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/test',
        query: { content: "<script>alert('XSS')</script>" }
      });

      expect(response.status).toBe(200);
      expect(response.headers['content-security-policy']).toBeDefined();
      
      const csp = response.headers['content-security-policy'];
      expect(csp).toContain("script-src 'self'");
      expect(csp).not.toContain("unsafe-inline");
      expect(csp).not.toContain("unsafe-eval");
    });

    test('should block unsafe eval', async () => {
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/test',
        query: { content: "eval('alert(\"XSS\")')" }
      });

      expect(response.status).toBe(200);
      expect(response.headers['content-security-policy']).toBeDefined();
      
      const csp = response.headers['content-security-policy'];
      expect(csp).not.toContain("unsafe-eval");
    });
  });

  describe('Input Sanitization', () => {
    test('should sanitize HTML tags', () => {
      const inputs = [
        "<script>alert('XSS')</script>",
        "<img src=x onerror=alert('XSS')>",
        "<svg onload=alert('XSS')>",
        "<iframe src=javascript:alert('XSS')>",
        "<body onload=alert('XSS')>",
        "<div onclick=alert('XSS')>Click me</div>",
        "<a href=javascript:alert('XSS')>Link</a>",
        "<meta http-equiv=refresh content=0;url=javascript:alert('XSS')>"
      ];

      inputs.forEach(input => {
        const sanitized = securityUtils.sanitizeHtml(input);
        
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('alert(');
        expect(sanitized).not.toContain('onerror');
        expect(sanitized).not.toContain('onload');
        expect(sanitized).not.toContain('onclick');
        expect(sanitized).not.toContain('javascript:');
        
        // Should contain HTML entities
        expect(sanitized).toContain('&lt;');
        expect(sanitized).toContain('&gt;');
      });
    });

    test('should sanitize JavaScript events', () => {
      const inputs = [
        "onclick=alert('XSS')",
        "onerror=alert('XSS')",
        "onload=alert('XSS')",
        "onmouseover=alert('XSS')",
        "onfocus=alert('XSS')",
        "onblur=alert('XSS')",
        "onchange=alert('XSS')",
        "onsubmit=alert('XSS')"
      ];

      inputs.forEach(input => {
        const sanitized = securityUtils.sanitizeEvents(input);
        
        expect(sanitized).not.toContain('onerror');
        expect(sanitized).not.toContain('onload');
        expect(sanitized).not.toContain('onclick');
        expect(sanitized).not.toContain('onmouseover');
        expect(sanitized).not.toContain('onfocus');
        expect(sanitized).not.toContain('onblur');
        expect(sanitized).not.toContain('onchange');
        expect(sanitized).not.toContain('onsubmit');
      });
    });

    test('should sanitize URLs', () => {
      const inputs = [
        "javascript:alert('XSS')",
        "data:text/html,<script>alert('XSS')</script>",
        "vbscript:alert('XSS')",
        "file://javascript:alert('XSS')",
        "ftp://javascript:alert('XSS')",
        "http://evil.com/script.js",
        "https://evil.com/script.js"
      ];

      inputs.forEach(input => {
        const sanitized = securityUtils.sanitizeUrl(input);
        
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('vbscript:');
        expect(sanitized).not.toContain('data:text/html');
        
        // Should be empty or safe URL
        expect(sanitized === '' || sanitized.startsWith('http://') || sanitized.startsWith('https://')).toBe(true);
      });
    });

    test('should sanitize CSS', () => {
      const inputs = [
        "background:url(javascript:alert('XSS'))",
        "background-image:url('javascript:alert(\"XSS\")')",
        "list-style:url('javascript:alert(\"XSS\")')",
        "content:attr(data-xss)",
        "behavior:url(script.htc)",
        "binding:url('javascript:alert(\"XSS\")')",
        "@import 'javascript:alert(\"XSS\")'",
        "expression(alert('XSS'))"
      ];

      inputs.forEach(input => {
        const sanitized = securityUtils.sanitizeCss(input);
        
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('expression(');
        expect(sanitized).not.toContain('@import');
        expect(sanitized).not.toContain('behavior:');
        expect(sanitized).not.toContain('binding:');
      });
    });
  });

  describe('Advanced XSS Techniques', () => {
    test('should block DOM-based XSS', async () => {
      const domXssPayloads = [
        "#<script>alert('XSS')</script>",
        "#<img src=x onerror=alert('XSS')>",
        "#<svg onload=alert('XSS')>",
        "javascript:alert('XSS')",
        "data:text/html,<script>alert('XSS')</script>",
        "vbscript:alert('XSS')",
        "<script>alert(String.fromCharCode(88,83,83))</script>",
        "<script>alert(/XSS/.source)</script>"
      ];

      for (const payload of domXssPayloads) {
        const response = await framework.testEndpoint({
          method: 'GET',
          path: `/api/test${payload}`,
          headers: { 'Authorization': 'Bearer test-token' }
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid parameter');
        
        // Ensure XSS payload is not reflected in response
        const responseText = JSON.stringify(response.body);
        expect(responseText).not.toContain('<script>');
        expect(responseText).not.toContain('alert(');
        expect(responseText).not.toContain('onerror');
        expect(responseText).not.toContain('onload');
      }
    });

    test('should block encoded XSS', async () => {
      const encodedPayloads = [
        "%3Cscript%3Ealert('XSS')%3C/script%3E",
        "%3Cimg%20src%3Dx%20onerror%3Dalert('XSS')%3E",
        "%3Csvg%20onload%3Dalert('XSS')%3E",
        "%26lt%3Bscript%26gt%3Balert('XSS')%26lt%3B/script%26gt%3B",
        "&#60;script&#62;alert('XSS')&#60;/script&#62;",
        "&lt;script&gt;alert('XSS')&lt;/script&gt;",
        "%253Cscript%253Ealert('XSS')%253C/script%253E",
        "%u003Cscript%u003Ealert('XSS')%u003C/script%u003E"
      ];

      for (const payload of encodedPayloads) {
        const response = await framework.testEndpoint({
          method: 'GET',
          path: `/api/test?param=${payload}`,
          headers: { 'Authorization': 'Bearer test-token' }
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid parameter');
        
        // Ensure XSS payload is not reflected in response
        const responseText = JSON.stringify(response.body);
        expect(responseText).not.toContain('<script>');
        expect(responseText).not.toContain('alert(');
      }
    });

    test('should block XSS in JSON responses', async () => {
      const xssPayloads = [
        "<script>alert('XSS')</script>",
        "<img src=x onerror=alert('XSS')>",
        "<svg onload=alert('XSS')>",
        "<iframe src=javascript:alert('XSS')>"
      ];

      for (const payload of xssPayloads) {
        const response = await framework.testEndpoint({
          method: 'GET',
          path: '/api/test',
          query: { data: payload }
        });

        expect(response.status).toBe(200);
        
        // Ensure JSON response is properly escaped
        const responseText = JSON.stringify(response.body);
        expect(responseText).not.toContain('<script>');
        expect(responseText).not.toContain('alert(');
        expect(responseText).not.toContain('onerror');
        expect(responseText).not.toContain('onload');
        
        // Should contain escaped entities
        expect(responseText).toContain('\\u003c');
        expect(responseText).toContain('\\u003e');
      }
    });
  });

  describe('XSS Prevention Validation', () => {
    test('should log XSS attempts', async () => {
      const xssPayloads = [
        "<script>alert('XSS')</script>",
        "<img src=x onerror=alert('XSS')>",
        "<svg onload=alert('XSS')>"
      ];

      for (const payload of xssPayloads) {
        const response = await framework.testEndpoint({
          method: 'POST',
          path: '/api/test',
          body: { content: payload },
          headers: { 'Authorization': 'Bearer test-token' }
        });

        expect(response.status).toBe(400);

        // Should log the security event
        const securityLogs = await framework.getSecurityLogs();
        const recentLogs = securityLogs.filter(log => 
          log.type === 'XSS_ATTEMPT' && 
          log.payload.includes(payload)
        );

        expect(recentLogs.length).toBeGreaterThan(0);
        expect(recentLogs[0].timestamp).toBeDefined();
        expect(recentLogs[0].ipAddress).toBeDefined();
        expect(recentLogs[0].userAgent).toBeDefined();
      }
    });

    test('should provide comprehensive XSS report', async () => {
      const report = await framework.generateXssReport();

      expect(report.timestamp).toBeDefined();
      expect(report.testResults).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.vulnerabilities).toBeDefined();
      expect(report.recommendations).toBeDefined();

      expect(report.summary.totalTests).toBeGreaterThan(0);
      expect(report.summary.testsPassed).toBe(report.summary.totalTests);
      expect(report.summary.vulnerabilitiesFound).toBe(0);

      expect(report.testResults.userInputs).toBeDefined();
      expect(report.testResults.fileUploads).toBeDefined();
      expect(report.testResults.apiResponses).toBeDefined();
      expect(report.testResults.contentSecurityPolicy).toBeDefined();
      expect(report.testResults.inputSanitization).toBeDefined();
      expect(report.testResults.advancedTechniques).toBeDefined();

      // Should include OWASP compliance
      expect(report.owaspCompliance).toBeDefined();
      expect(report.owaspCompliance.a03_injection).toBeDefined();
      expect(report.owaspCompliance.a03_injection.status).toBe('COMPLIANT');
    });
  });

  afterAll(async () => {
    await framework.cleanup();
  });
});
