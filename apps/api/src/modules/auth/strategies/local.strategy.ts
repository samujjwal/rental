import { Injectable, UnauthorizedException } from '@nestjs/common';
import { i18nUnauthorized } from '@/common/errors/i18n-exceptions';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../services/auth.service';
import { User } from '@rental-portal/database';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      usernameField: 'email',
      passwordField: 'password',
    });
  }

  async validate(email: string, password: string): Promise<User> {
    const result = await this.authService.login({ email, password });

    if (!result) {
      throw i18nUnauthorized('auth.invalidCredentials');
    }

    return result.user as User;
  }
}
