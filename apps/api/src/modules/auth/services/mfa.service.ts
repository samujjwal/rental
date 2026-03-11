import { Injectable, Logger } from '@nestjs/common';
import * as otplib from 'otplib';
import * as QRCode from 'qrcode';
import { randomBytes } from 'crypto';
import { CacheService } from '@/common/cache/cache.service';

// TOTP codes are valid for one 30-second window. Cache used codes for 3 windows (90s)
// to prevent replay attacks where an attacker reuses a just-seen 6-digit code.
const TOTP_USED_TTL_SECONDS = 90;
const TOTP_USED_KEY_PREFIX = 'totp:used:';

@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);

  constructor(private readonly cache: CacheService) {}

  async generateSecret(email: string): Promise<{ secret: string; qrCode: string }> {
    const secret = otplib.generateSecret();
    const otpauth = otplib.generateURI({
      secret,
      issuer: 'GharBatai Rentals',
      label: email,
    });
    const qrCode = await QRCode.toDataURL(otpauth);

    return { secret, qrCode };
  }

  async verifyToken(secret: string, token: string): Promise<boolean> {
    try {
      if (!otplib.verifySync({ token, secret }).valid) {
        return false;
      }
      // Replay-attack guard: reject if this exact code was already consumed
      const usedKey = `${TOTP_USED_KEY_PREFIX}${secret}:${token}`;
      const alreadyUsed = await this.cache.get<boolean>(usedKey);
      if (alreadyUsed) {
        this.logger.warn('TOTP replay detected — code already consumed');
        return false;
      }
      await this.cache.set(usedKey, true, TOTP_USED_TTL_SECONDS);
      return true;
    } catch (error) {
      this.logger.warn(`MFA token verification failed: ${error instanceof Error ? error.message : error}`);
      return false;
    }
  }

  generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }
    return codes;
  }
}
