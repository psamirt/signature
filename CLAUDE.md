# api/ — NestJS + Prisma

Ver también [`../CLAUDE.md`](../CLAUDE.md) para cómo encaja esto con `web/`.

## Estructura

Módulos en `src/modules/*`, cada uno con `*.controller.ts`, `*.service.ts`, `*.module.ts`, y `dto/` si aplica:

- `products/`, `inventory/` — catálogo y stock. Consumidos por el bot (inyección directa) y por el panel (HTTP, guardado con `AdminAuthGuard`).
- `catalog/` — feed CSV para Meta Commerce (`FeedAuthGuard`, Basic Auth **opcional**) y páginas públicas de producto (`/p/:slug`, sin guard).
- `whatsapp/`, `agent/`, `conversations/` — el bot en sí (webhook de Meta, OpenAI, historial).
- `auth/` — guards compartidos (`AdminAuthGuard`).
- `legal/`, `health/` — páginas de privacidad/términos y healthcheck.

Config centralizada en `src/config/*.config.ts` (un objeto por dominio: `appConfig`, `catalogConfig`, `adminConfig`, `whatsappConfig`, `openaiConfig`, `legalConfig`), cada uno leyendo `process.env` en getters. Nunca leer `process.env` directo en un service.

## Patrón para un guard de Basic Auth nuevo

Ya hay dos: `FeedAuthGuard` (feed de Meta, credenciales opcionales — sin ellas el feed es público) y `AdminAuthGuard` (panel, credenciales **obligatorias**). Si necesitas un tercero, copia `AdminAuthGuard` (`src/modules/auth/admin-auth.guard.ts`): mismo parseo de header `Basic`, misma comparación con `timingSafeEqual` de `node:crypto` (nunca `===`, filtra la clave por timing). No se registra como provider en el módulo, solo se referencia en `@UseGuards(...)`.

## Patrón para un recurso CRUD nuevo (ver `products` como referencia completa)

1. DTOs en `dto/create-x.dto.ts` / `dto/update-x.dto.ts` con `class-validator`. El de creación tiene campos requeridos; el de edición, todos opcionales (no uses `PartialType` de `@nestjs/mapped-types` — no está instalado, se escriben los campos opcionales a mano, ver `update-product.dto.ts`).
2. Si el recurso tiene una relación 1:1 que se edita junto con él (como `Inventory` con `Product`), acepta un objeto anidado opcional en el DTO con `@ValidateNested()` + `@Type(() => XDto)`.
3. Service: `create`/`update`/`remove` en `$transaction` si tocan más de una tabla. Revisa las FKs (`ON DELETE RESTRICT` es el default de las migraciones existentes) antes de asumir que un `delete` en cascada funciona — puede que haga falta borrar la fila relacionada primero.
4. Controller: `@Controller('recurso')` + `@UseGuards(AdminAuthGuard)` a nivel de clase si todo el recurso es admin-only (así no hay que repetirlo en cada método).
5. Antes de exponer `GET` de un recurso ya existente por HTTP, confirma que nada interno (bot, catalog) dependa de que sea público — revisa si algún otro módulo llama al service por inyección directa en vez de HTTP.

## Comandos

```bash
pnpm start:dev       # watch mode, puerto 3000
pnpm build           # tsc, usar para validar tipos antes de dar por terminado un cambio
pnpm db:seed         # prisma/seed.ts — upsert de productos de ejemplo
pnpm test            # jest
```

Migraciones: `npx prisma migrate dev` tras tocar `prisma/schema.prisma` (no lo hagas a mano en `migrations/`).
