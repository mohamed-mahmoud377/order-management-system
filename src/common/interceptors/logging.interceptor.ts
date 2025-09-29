import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();

    const { method, url } = req;
    const start = Date.now();

    const requestId = req.headers?.['x-request-id'] || req.headers?.['x-correlation-id'];

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - start;
        const status = res?.statusCode ?? '-';
        const rid = requestId ? `[${requestId}] ` : '';
        this.logger.log(`${rid}${method} ${url} -> ${status} ${ms}ms`);
      }),
    );
  }
}
