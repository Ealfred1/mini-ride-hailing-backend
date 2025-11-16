import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>() as any;
    const start = Date.now();
    return next.handle().pipe(
      tap(() => {
        if (!request) {
          return;
        }
        const elapsed = Date.now() - start;
        this.logger.log(
          `${request.method} ${request.url} ${request.statusCode ?? ''} ${elapsed}ms`,
        );
      }),
    );
  }
}

