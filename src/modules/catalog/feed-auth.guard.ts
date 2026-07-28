import { timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { catalogConfig } from '../../config/catalog.config';

/**
 * Autenticación HTTP Basic opcional para el feed del catálogo.
 *
 * Si CATALOG_FEED_USER y CATALOG_FEED_PASSWORD están vacíos, el feed queda
 * público (comportamiento por defecto). En cuanto los definas, hay que poner
 * las mismas credenciales en el Administrador de ventas de Meta, en los campos
 * de usuario y contraseña junto a la URL del feed.
 *
 * NO se aplica a las páginas de producto (/p/:slug): el rastreador de Meta no
 * se autentica contra ellas y los clientes las abren desde la ficha, así que
 * protegerlas rompería el catálogo.
 */
@Injectable()
export class FeedAuthGuard implements CanActivate {
  private readonly logger = new Logger(FeedAuthGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const { user, password } = catalogConfig.feedAuth;

    // Sin credenciales configuradas, el feed es público.
    if (!user || !password) return true;

    const http = context.switchToHttp();
    const header = http.getRequest<Request>().headers.authorization;

    if (!header?.startsWith('Basic ')) {
      // Sin WWW-Authenticate, algunos clientes no reintentan con credenciales.
      http
        .getResponse<Response>()
        .setHeader('WWW-Authenticate', 'Basic realm="catalog"');
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
      !FeedAuthGuard.safeEqual(provided.user, user) ||
      !FeedAuthGuard.safeEqual(provided.password, password)
    ) {
      this.logger.warn('Intento de acceso al feed con credenciales inválidas.');
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
