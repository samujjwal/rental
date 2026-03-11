import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PasswordService {
  private readonly rounds: number;

  /** Top 100 most common passwords — reject immediately */
  private static readonly COMMON_PASSWORDS = new Set([
    'password', '123456', '12345678', 'qwerty', 'abc123', 'monkey', 'master',
    'dragon', '111111', 'baseball', 'iloveyou', 'trustno1', 'sunshine',
    'ashley', 'football', 'shadow', '123123', '654321', 'superman', 'qazwsx',
    'michael', 'football1', 'password1', 'password123', 'batman', 'access',
    'hello', 'charlie', 'donald', '12345', '1234567', '123456789', '1234567890',
    'letmein', 'welcome', 'login', 'admin', 'princess', 'starwars',
    'passw0rd', 'solo', 'qwerty123', 'mustang', 'bailey', 'passpass',
    'flower', 'love', 'test', 'robert', 'jordan', 'access14', 'soccer',
    'hockey', 'ranger', 'buster', 'harley', 'hunter', 'andrew', 'tigger',
    'joshua', 'thomas', 'george', 'summer', 'jessica', 'ginger', 'abcdef',
    'pepper', 'qwert', 'zxcvbn', '121212', 'killer', 'dallas', 'thunder',
    'austin', 'yankees', 'jennifer', 'corvette', 'blahblah', 'asdfgh',
    'whatever', 'computer', 'pass', 'internet', 'freedom', 'secret',
    '000000', 'nothing', 'matrix', 'winter', 'hottie', 'guitar', 'chicken',
    'panther', 'cookie', 'orange', 'banana', 'samantha', 'sparky', 'diamond',
  ]);

  constructor(private readonly configService: ConfigService) {
    this.rounds = this.configService.get('bcryptRounds', 10);
  }

  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.rounds);
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  validateStrength(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Dictionary check — reject common passwords
    if (PasswordService.COMMON_PASSWORDS.has(password.toLowerCase())) {
      errors.push('Password is too common. Please choose a more unique password');
    }

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
