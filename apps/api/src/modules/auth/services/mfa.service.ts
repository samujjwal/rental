import { Injectable } from '@nestjs/common';
import * as otplib from 'otplib';
import * as QRCode from 'qrcode';

@Injectable()
export class MfaService {
  async generateSecret(email: string): Promise<{ secret: string; qrCode: string }> {
    const secret = otplib.generateSecret();
    const otpauth = otplib.generateURI({
      secret,
      issuer: 'Rental Portal',
      label: email,
    });
    const qrCode = await QRCode.toDataURL(otpauth);

    return { secret, qrCode };
  }

  verifyToken(secret: string, token: string): boolean {
    try {
      return otplib.verifySync({ token, secret }).valid;
    } catch (error) {
      return false;
    }
  }

  generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    return codes;
  }
}
