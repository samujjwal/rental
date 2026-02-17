import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { AuthService } from '../services/auth.service';

@Injectable()
export class WsJwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtAuthGuard.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient();
      const auth = await this.authenticateClient(client);

      client.handshake.auth = {
        ...client.handshake.auth,
        userId: auth.userId,
        email: auth.email,
      };
      client.data.userId = auth.userId;

      return true;
    } catch (error) {
      this.logger.error('WebSocket auth error:', error);
      throw new WsException('Unauthorized');
    }
  }

  async authenticateClient(client: Socket): Promise<{ userId: string; email?: string }> {
    const token = this.extractToken(client);

    if (!token) {
      throw new WsException('No token provided');
    }

    const secret =
      this.configService.get<string>('jwt.secret') || this.configService.get<string>('JWT_SECRET');

    if (!secret) {
      throw new WsException('Auth configuration missing');
    }

    const payload = await this.jwtService.verifyAsync<{ sub: string; email?: string }>(token, {
      secret,
    });

    const user = await this.authService.validateUser(payload.sub);
    if (!user) {
      throw new WsException('User not found or inactive');
    }

    const hasActiveSession = await this.authService.validateSessionToken(payload.sub, token);
    if (!hasActiveSession) {
      throw new WsException('Session expired or invalidated');
    }

    return { userId: payload.sub, email: payload.email };
  }

  private extractToken(client: Socket): string | null {
    // Try to get token from auth header
    const authHeader = client.handshake.headers.authorization;
    if (authHeader) {
      const [type, token] = authHeader.split(' ');
      return type === 'Bearer' ? token : null;
    }

    // Try to get token from query parameter
    const token = client.handshake.query.token;
    if (token && typeof token === 'string') {
      return token;
    }

    // Try to get token from auth object
    if (client.handshake.auth?.token) {
      return client.handshake.auth.token;
    }

    return null;
  }
}
