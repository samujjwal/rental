import { Injectable, UnauthorizedException } from '@nestjs/common';
import { i18nUnauthorized } from '@/common/errors/i18n-exceptions';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../services/auth.service';
import { TokenPayload } from '../services/token.service';
import { User } from '@rental-portal/database';
import type { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('jwt.secret'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: TokenPayload): Promise<User> {
    const user = await this.authService.validateUser(payload.sub);

    if (!user) {
      throw i18nUnauthorized('auth.userNotFoundOrInactive');
    }

    const accessToken = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    const hasActiveSession = await this.authService.validateSessionToken(payload.sub, accessToken);

    if (!hasActiveSession) {
      throw i18nUnauthorized('auth.sessionExpired');
    }

    return user;
  }
}
