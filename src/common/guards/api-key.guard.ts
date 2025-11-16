import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const configuredKey = process.env.API_KEY;
    if (!configuredKey) {
      return true;
    }
    const providedKey =
      request.headers['x-api-key'] ||
      request.headers['x-api_key'] ||
      request.headers['apikey'];
    if (typeof providedKey === 'string' && providedKey === configuredKey) {
      return true;
    }
    throw new UnauthorizedException('Invalid API key');
  }
}

