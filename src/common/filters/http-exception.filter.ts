import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const normalized = this.normalizeException(exception, status);

    const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';

    const logContext = `${req.method} ${req.url} -> ${status} ${normalized.code}`;
    if (!isProd) {
      this.logger.error(logContext, (exception as any)?.stack);
    } else {
      this.logger.error(logContext);
    }

    const body: any = {
      success: false,
      statusCode: status,
      code: normalized.code,
      message: normalized.message,
      errors: normalized.errors?.length ? normalized.errors : undefined,
      path: req.url,
      method: req.method,
      timestamp: new Date().toISOString(),
    };

    const requestId = req.headers?.['x-request-id'] || req.headers?.['x-correlation-id'];
    if (requestId) body.requestId = requestId;

    if (!isProd && normalized.stack) body.stack = normalized.stack;

    res.status(status).json(body);
  }

  private normalizeException(exception: unknown, status: number) {
    const isHttp = exception instanceof HttpException;

    const result: { code: string; message: string; errors?: any[]; stack?: string } = {
      code: this.defaultCodeForStatus(status),
      message: 'An unexpected error occurred',
    };

    const anyEx = exception as any;

    if (isHttp) {
      const response = (exception as HttpException).getResponse();
      if (typeof response === 'string') {
        result.message = response;
      } else if (typeof response === 'object' && response) {
        const msg = (response as any).message;
        if (Array.isArray(msg)) {
          result.message = 'Validation failed';
          result.errors = msg.map((m: any) => (typeof m === 'string' ? { message: m } : m));
          result.code = 'VALIDATION_ERROR';
        } else if (typeof msg === 'string') {
          result.message = msg;
        } else if ((response as any).error) {
          result.message = (response as any).error;
        }

        if (typeof (response as any).code === 'string') {
          result.code = (response as any).code;
        }
      }
    }

    if (typeof anyEx?.code === 'string' && anyEx?.code.startsWith('P')) {
      if (anyEx.code === 'P2002') {
        result.code = 'CONFLICT_DUPLICATE';
        result.message = 'Resource already exists';
        if (!status || status === HttpStatus.INTERNAL_SERVER_ERROR) {
          status = HttpStatus.CONFLICT;
        }
      } else if (anyEx.code === 'P2025') {
        result.code = 'NOT_FOUND';
        result.message = 'Resource not found';
      } else {
        result.code = `PRISMA_${anyEx.code}`;
        result.message = anyEx.message || result.message;
      }
    }

    if (status === HttpStatus.UNAUTHORIZED && !result.code) {
      result.code = 'UNAUTHORIZED';
    }
    if (status === HttpStatus.FORBIDDEN && !result.code) {
      result.code = 'FORBIDDEN';
    }
    if (status === HttpStatus.NOT_FOUND && !result.code) {
      result.code = 'NOT_FOUND';
    }
    if (status === HttpStatus.BAD_REQUEST && !result.code) {
      result.code = 'BAD_REQUEST';
    }

    if (!isHttp && typeof anyEx?.message === 'string') {
      result.message = anyEx.message;
    }

    if (typeof anyEx?.stack === 'string') {
      result.stack = anyEx.stack;
    }

    return result;
  }

  private defaultCodeForStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'UNPROCESSABLE_ENTITY';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'TOO_MANY_REQUESTS';
      case HttpStatus.INTERNAL_SERVER_ERROR:
      default:
        return 'INTERNAL_SERVER_ERROR';
    }
  }
}
