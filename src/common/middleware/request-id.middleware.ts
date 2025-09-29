import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const headerName = 'x-request-id';
    let requestId = (req.headers['x-request-id'] as string) || (req.headers['x-correlation-id'] as string);

    if (!requestId) {
      try {
        requestId = randomUUID();
      } catch {
        requestId = Math.random().toString(36).slice(2) + Date.now().toString(36);
      }
      req.headers[headerName] = requestId;
    }

    res.setHeader(headerName, requestId);
    res.setHeader('x-correlation-id', requestId);

    // attach for downstream usage
    (req as any).requestId = requestId;

    next();
  }
}
