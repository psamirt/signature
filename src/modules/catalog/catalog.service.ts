import { Injectable } from '@nestjs/common';
import { catalogConfig } from '../../config/catalog.config';
import {
  ProductsService,
  type ProductWithInventory,
} from '../products/products.service';

/** Campos requeridos por Meta, en el orden del encabezado del CSV. */
const FEED_COLUMNS = [
  'id',
  'title',
  'description',
  'availability',
  'condition',
  'price',
  'link',
  'image_link',
  'brand',
] as const;

export interface CatalogReadiness {
  total: number;
  ready: number;
  excluded: { slug: string; name: string; missing: string[] }[];
  feedUrl: string;
}

@Injectable()
export class CatalogService {
  constructor(private readonly productsService: ProductsService) {}

  /**
   * Feed en CSV para el Administrador de ventas. Sólo incluye productos que
   * cumplen todos los campos obligatorios: una fila incompleta se rechaza
   * entera, así que es mejor omitirla y reportarla en /catalog/status.
   */
  async buildCsv(): Promise<string> {
    const products = await this.productsService.findAll();
    const rows = products
      .filter((p) => p.active && CatalogService.missingFields(p).length === 0)
      .map((p) => CatalogService.toRow(p));

    return [
      FEED_COLUMNS.join(','),
      ...rows.map((row) =>
        FEED_COLUMNS.map((col) => CatalogService.escapeCsv(row[col])).join(','),
      ),
    ].join('\n');
  }

  /** Qué productos entran al feed y qué le falta a los que no. */
  async getReadiness(): Promise<CatalogReadiness> {
    const products = await this.productsService.findAll();
    const active = products.filter((p) => p.active);

    const excluded = active
      .map((p) => ({
        slug: p.slug,
        name: p.name,
        missing: CatalogService.missingFields(p),
      }))
      .filter((entry) => entry.missing.length > 0);

    return {
      total: active.length,
      ready: active.length - excluded.length,
      excluded,
      feedUrl: `${catalogConfig.baseUrl}/catalog/feed.csv`,
    };
  }

  /**
   * Página pública del producto, que es el destino de `link` en el feed.
   * Meta rastrea esta página y compara el precio y la disponibilidad con el
   * feed: al generarla desde la misma base de datos, no pueden discrepar.
   */
  async productPageHtml(slug: string): Promise<string | null> {
    const products = await this.productsService.findAll();
    const product = products.find((p) => p.slug === slug && p.active);
    if (!product) return null;

    const stock = product.inventory?.stock ?? 0;
    const price = CatalogService.formatPrice(product);

    return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${CatalogService.escapeHtml(product.name)} — ${CatalogService.escapeHtml(catalogConfig.brand)}</title>
<meta property="og:title" content="${CatalogService.escapeHtml(product.name)}">
<meta property="og:type" content="product">
<meta property="product:price:amount" content="${Number(product.price).toFixed(2)}">
<meta property="product:price:currency" content="${catalogConfig.currency}">
<meta property="product:availability" content="${stock > 0 ? 'in stock' : 'out of stock'}">
${product.imageUrl ? `<meta property="og:image" content="${CatalogService.escapeHtml(product.imageUrl)}">` : ''}
<style>
  :root { color-scheme: light dark; }
  body {
    max-width: 40rem; margin: 0 auto; padding: 2.5rem 1.25rem 5rem;
    font: 16px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  img { max-width: 100%; border-radius: .5rem; }
  .price { font-size: 1.5rem; font-weight: 600; margin: .5rem 0; }
  .stock { opacity: .75; }
  .brand { opacity: .6; font-size: .9rem; text-transform: uppercase; letter-spacing: .08em; }
</style>
</head>
<body>
<p class="brand">${CatalogService.escapeHtml(product.brand ?? catalogConfig.brand)}</p>
<h1>${CatalogService.escapeHtml(product.name)}</h1>
${product.imageUrl ? `<img src="${CatalogService.escapeHtml(product.imageUrl)}" alt="${CatalogService.escapeHtml(product.name)}">` : ''}
<p class="price">${price}</p>
<p class="stock">${stock > 0 ? `Disponible — ${stock} en stock` : 'Agotado por ahora'}</p>
<p>${CatalogService.escapeHtml(product.description ?? '')}</p>
</body>
</html>`;
  }

  /** Campos obligatorios de Meta que el producto no tiene. */
  private static missingFields(product: ProductWithInventory): string[] {
    const missing: string[] = [];
    if (!product.imageUrl) missing.push('image_link');
    if (!product.description) missing.push('description');
    if (!product.name) missing.push('title');
    return missing;
  }

  private static toRow(
    product: ProductWithInventory,
  ): Record<(typeof FEED_COLUMNS)[number], string> {
    const stock = product.inventory?.stock ?? 0;

    return {
      // El SKU es el identificador estable preferido por Meta.
      id: product.inventory?.sku ?? product.slug,
      title: product.name.slice(0, 200),
      description: (product.description ?? product.name).slice(0, 9999),
      availability: stock > 0 ? 'in stock' : 'out of stock',
      condition: catalogConfig.condition,
      // Número, espacio, código de moneda. Punto decimal, sin símbolo.
      price: `${Number(product.price).toFixed(2)} ${catalogConfig.currency}`,
      link: `${catalogConfig.baseUrl}/p/${product.slug}`,
      image_link: product.imageUrl ?? '',
      brand: (product.brand ?? catalogConfig.brand).slice(0, 100),
    };
  }

  /** Comillas dobles y separadores según RFC 4180. */
  private static escapeCsv(value: string): string {
    if (/[",\n\r]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private static escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private static formatPrice(product: ProductWithInventory): string {
    return `${catalogConfig.currency === 'PEN' ? 'S/' : catalogConfig.currency} ${Number(product.price).toFixed(2)}`;
  }
}
