import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CatalogService, type CatalogReadiness } from './catalog.service';
import { FeedAuthGuard } from './feed-auth.guard';

@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  /**
   * Feed que se pega en el Administrador de ventas de Meta
   * ("Usar una URL u Hojas de cálculo de Google").
   */
  @Get('catalog/feed.csv')
  // Sin CATALOG_FEED_USER/PASSWORD definidos, el guard deja pasar todo.
  @UseGuards(FeedAuthGuard)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'inline; filename="catalogo.csv"')
  // Meta reprocesa el feed periódicamente; una cache corta evita golpear la BD
  // en cada rastreo sin retrasar demasiado un cambio de precio o stock.
  @Header('Cache-Control', 'public, max-age=300')
  feedCsv(): Promise<string> {
    return this.catalogService.buildCsv();
  }

  /** Qué productos entran al feed y qué le falta a los que no. */
  @Get('catalog/status')
  status(): Promise<CatalogReadiness> {
    return this.catalogService.getReadiness();
  }

  /**
   * Página de producto: el destino de `link` en el feed. Con ?v=decant muestra
   * el precio y la disponibilidad del decant en vez de los del frasco.
   */
  @Get('p/:slug')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async productPage(
    @Param('slug') slug: string,
    @Query('v') variant?: string,
  ): Promise<string> {
    const html = await this.catalogService.productPageHtml(
      slug,
      variant === 'decant' ? 'decant' : 'full',
    );
    if (!html) throw new NotFoundException('Producto no encontrado');
    return html;
  }
}
