/**
 * FieldEncryptionService
 *
 * AES-256-GCM symmetric encryption for sensitive DB fields that must be
 * retrievable (e.g. mfaSecret, governmentIdNumber).  Fields that only need
 * one-way verification (passwords, reset tokens) use bcrypt/SHA-256 instead.
 *
 * Requires env var `FIELD_ENCRYPTION_KEY` — a 64-character hex string
 * representing 32 random bytes, generated once with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Optionally set `FIELD_ENCRYPTION_KEY_PREVIOUS` to a previous key to allow
 * transparent decryption of data encrypted with the old key during rotation.
 *
 * Ciphertext format: v<version>:<iv_hex>:<authTag_hex>:<ciphertext_hex>
 * All segments after the version are hex-encoded and separated by ':'.
 * Unversioned (legacy) format is also supported for backward compatibility.
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag
const CURRENT_KEY_VERSION = 1;

@Injectable()
export class FieldEncryptionService implements OnModuleInit {
  private readonly logger = new Logger(FieldEncryptionService.name);
  private key: Buffer;
  private previousKey: Buffer | null = null;
  private configured = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const hexKey = this.config.get<string>('FIELD_ENCRYPTION_KEY');

    if (!hexKey) {
      const env = process.env.NODE_ENV;
      if (env !== 'development' && env !== 'test') {
        // Require a real key in production AND staging/ci environments.
        throw new Error(
          'FIELD_ENCRYPTION_KEY must be set in all non-development environments. ' +
          'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
        );
      }
      // Development only: use a deterministic fallback key so existing dev data
      // isn't corrupted across restarts.  Never deploy this key outside dev/test.
      const devKey = '0011223344556677889900aabbccddeeff0011223344556677889900aabbccdd';
      this.key = Buffer.from(devKey, 'hex');
      this.logger.warn(
        'FIELD_ENCRYPTION_KEY not set — using insecure deterministic dev key. ' +
        'Set FIELD_ENCRYPTION_KEY in all non-development environments.',
      );
    } else {
      if (hexKey.length !== 64) {
        throw new Error(
          `FIELD_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). Got ${hexKey.length}.`,
        );
      }
      this.key = Buffer.from(hexKey, 'hex');
    }

    // Load previous key for transparent decryption during key rotation
    const prevHexKey = this.config.get<string>('FIELD_ENCRYPTION_KEY_PREVIOUS');
    if (prevHexKey) {
      if (prevHexKey.length !== 64) {
        this.logger.warn(
          'FIELD_ENCRYPTION_KEY_PREVIOUS has invalid length — ignoring.',
        );
      } else {
        this.previousKey = Buffer.from(prevHexKey, 'hex');
        this.logger.log('Previous encryption key loaded for key rotation.');
      }
    }

    this.configured = true;
  }

  /**
   * Encrypt a plaintext string.
   * Returns a string in the format: <iv>:<authTag>:<ciphertext>  (all hex)
   * Returns null if input is null/undefined.
   */
  encrypt(plaintext: string): string;
  encrypt(plaintext: string | null | undefined): string | null;
  encrypt(plaintext: string | null | undefined): string | null {
    if (plaintext == null) return null;
    if (!this.configured) throw new Error('FieldEncryptionService not initialised');

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv, { authTagLength: AUTH_TAG_LENGTH });
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return `v${CURRENT_KEY_VERSION}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /**
   * Decrypt a ciphertext produced by encrypt().
   * Returns null if input is null/undefined.
   * Throws if the ciphertext is malformed or the auth tag doesn't match.
   */
  decrypt(ciphertext: string): string;
  decrypt(ciphertext: string | null | undefined): string | null;
  decrypt(ciphertext: string | null | undefined): string | null {
    if (ciphertext == null) return null;
    if (!this.configured) throw new Error('FieldEncryptionService not initialised');

    // Legacy plaintext stored before encryption was introduced — return as-is.
    // Versioned format: v<N>:<iv>:<authTag>:<ciphertext> (4 parts)
    // Unversioned legacy: <iv>:<authTag>:<ciphertext> (3 parts)
    const parts = ciphertext.split(':');

    let ivHex: string;
    let authTagHex: string;
    let encryptedHex: string;

    if (parts.length === 4 && parts[0].startsWith('v')) {
      // Versioned format
      [, ivHex, authTagHex, encryptedHex] = parts;
    } else if (parts.length === 3) {
      // Unversioned legacy format
      [ivHex, authTagHex, encryptedHex] = parts;
    } else {
      this.logger.warn(
        'decrypt() received value without expected format — treating as legacy plaintext. ' +
        'Re-save the record to encrypt it.',
      );
      return ciphertext;
    }

    // Try current key first
    try {
      return this.decryptWithKey(this.key, ivHex, authTagHex, encryptedHex);
    } catch (err) {
      // If we have a previous key, try that (key rotation scenario)
      if (this.previousKey) {
        try {
          const result = this.decryptWithKey(this.previousKey, ivHex, authTagHex, encryptedHex);
          this.logger.debug('Decrypted with previous key — re-save to re-encrypt with current key.');
          return result;
        } catch (prevKeyErr) {
          this.logger.debug(`Decryption failed with both current and previous keys: ${prevKeyErr instanceof Error ? prevKeyErr.message : prevKeyErr}`);
        }
      }
      throw err;
    }
  }

  /** True if the value looks like an encrypted blob (has the right format). */
  isEncrypted(value: string | null | undefined): boolean {
    if (!value) return false;
    const parts = value.split(':');
    // Versioned: v1:iv:tag:data (4 parts) or unversioned legacy: iv:tag:data (3 parts)
    return parts.length === 3 || (parts.length === 4 && parts[0].startsWith('v'));
  }

  private decryptWithKey(key: Buffer, ivHex: string, authTagHex: string, encryptedHex: string): string {
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');

    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);

    return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
  }
}
