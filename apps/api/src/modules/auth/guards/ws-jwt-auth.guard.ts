import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Injectable()
export class WsJwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtAuthGuard.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient();
      const token = this.extractToken(client);

      if (!token) {
        throw new WsException('No token provided');
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      // Attach user to socket
      client.handshake.auth = {
        ...client.handshake.auth,
        userId: payload.sub,
        email: payload.email,
      };

      return true;
    } catch (error) {
      this.logger.error('WebSocket auth error:', error);
      throw new WsException('Unauthorized');
    }
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
