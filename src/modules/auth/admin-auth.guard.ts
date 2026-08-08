import { timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { adminConfig } from '../../config/admin.config';

/**
 * Autenticación HTTP Basic para el panel de gestión (productos, inventario).
 * A diferencia de FeedAuthGuard, aquí las credenciales son obligatorias:
 * sin ADMIN_USER/ADMIN_PASSWORD configurados, el guard rechaza todo.
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  private readonly logger = new Logger(AdminAuthGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const { user, password } = adminConfig;

    if (!user || !password) {
      throw new InternalServerErrorException(
        'ADMIN_USER/ADMIN_PASSWORD no están configurados en el servidor.',
      );
    }

    const http = context.switchToHttp();
    const header = http.getRequest<Request>().headers.authorization;

    if (!header?.startsWith('Basic ')) {
      http
        .getResponse<Response>()
        .setHeader('WWW-Authenticate', 'Basic realm="admin"');
      throw new UnauthorizedException('Credenciales requeridas');
    }

    const decoded = Buffer.from(
      header.slice('Basic '.length),
      'base64',
    ).toString('utf8');
    const separator = decoded.indexOf(':');
    const provided =
      separator === -1
        ? { user: decoded, password: '' }
        : {
            user: decoded.slice(0, separator),
            password: decoded.slice(separator + 1),
          };

    if (
      !AdminAuthGuard.safeEqual(provided.user, user) ||
      !AdminAuthGuard.safeEqual(provided.password, password)
    ) {
      this.logger.warn('Intento de acceso al panel con credenciales inválidas.');
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return true;
  }

  /** Comparación de tiempo constante, para no filtrar la clave por latencia. */
  private static safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }
}
