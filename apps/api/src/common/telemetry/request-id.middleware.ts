import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Middleware that generates or propagates an x-request-id header on every
 * request/response. If the client sends one it is kept; otherwise a UUID v4
 * is minted.  The id is attached to `req.requestId` for downstream use in
 * logging, error reporting, and distributed tracing.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const id = (req.headers[REQUEST_ID_HEADER] as string) || randomUUID();
    (req as any).requestId = id;
    res.setHeader(REQUEST_ID_HEADER, id);
    next();
  }
}
