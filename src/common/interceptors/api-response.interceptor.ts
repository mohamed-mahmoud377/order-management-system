import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface BaseApiResponse<T = any> {
  success: boolean;
  statusCode: number;
  code?: string;
  message?: string;
  data?: T;
  meta?: any;
  path?: string;
  method?: string;
  timestamp: string;
  requestId?: string;
}

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();

    return next.handle().pipe(
      map((originalData) => {
        // If controller already returns a BaseApiResponse (escape hatch), pass through
        if (originalData && typeof originalData === 'object' && originalData.success !== undefined && originalData.timestamp) {
          return originalData;
        }

        const statusCode = res?.statusCode ?? 200;
        const base: BaseApiResponse = {
          success: true,
          statusCode,
          code: 'OK',
          data: undefined,
          meta: undefined,
          path: req?.url,
          method: req?.method,
          timestamp: new Date().toISOString(),
        };

        const requestId = req?.headers?.['x-request-id'] || req?.headers?.['x-correlation-id'] || (req as any)?.requestId;
        if (requestId) (base as any).requestId = requestId as string;

        // Try to infer pagination/meta patterns commonly used
        if (originalData && typeof originalData === 'object') {
          // Pattern: { items, total, skip?, take? }
          if (Array.isArray((originalData as any).items) && typeof (originalData as any).total === 'number') {
            const { items, total, skip, take, page, limit } = originalData as any;
            base.data = items;
            base.meta = {
              total,
              skip: typeof skip === 'number' ? skip : undefined,
              take: typeof take === 'number' ? take : undefined,
              page: typeof page === 'number' ? page : undefined,
              limit: typeof limit === 'number' ? limit : undefined,
            };
          } else {
            base.data = originalData;
          }
        } else {
          base.data = originalData;
        }

        return base;
      }),
    );
  }
}
