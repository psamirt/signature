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

type FeedRow = Record<(typeof FEED_COLUMNS)[number], string>;

/** Presentación de un perfume: frasco lleno o decant. */
type Variant = 'full' | 'decant';

export interface CatalogReadiness {
  total: number;
  ready: number;
  /** Filas que realmente entran al feed (frascos + decants). */
  feedRows: number;
  excluded: { slug: string; name: string; missing: string[] }[];
  feedUrl: string;
}

@Injectable()
export class CatalogService {
  constructor(private readonly productsService: ProductsService) {}

  /**
   * Feed en CSV para el Administrador de ventas. Cada perfume genera hasta dos
   * filas: el frasco lleno y, si se decanta, el decant. Cada presentación es un
   * producto distinto en la tiendita, con su propio id, precio y disponibilidad.
   * Una fila incompleta se rechaza entera, así que se omite y se reporta en
   * /catalog/status.
   */
  async buildCsv(): Promise<string> {
    const products = await this.productsService.findAll();
    const rows = products
      .filter((p) => p.active && CatalogService.missingFields(p).length === 0)
      .flatMap((p) => CatalogService.toRows(p));

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

    const ready = active.filter(
      (p) => CatalogService.missingFields(p).length === 0,
    );
    const feedRows = ready.reduce(
      (sum, p) => sum + CatalogService.toRows(p).length,
      0,
    );

    return {
      total: active.length,
      ready: ready.length,
      feedRows,
      excluded,
      feedUrl: `${catalogConfig.baseUrl}/catalog/feed.csv`,
    };
  }

  /**
   * Página pública del producto, destino de `link` en el feed. Meta la rastrea
   * y compara precio y disponibilidad con el feed, así que la variante (frasco
   * o decant) debe reflejar el mismo precio que su fila. Se selecciona con ?v=decant.
   */
  async productPageHtml(
    slug: string,
    variant: Variant = 'full',
  ): Promise<string | null> {
    const products = await this.productsService.findAll();
    const product = products.find((p) => p.slug === slug && p.active);
    if (!product) return null;

    const av = ProductsService.availability(product);
    // Si piden el decant pero el perfume no se decanta, se cae al frasco.
    const isDecant = variant === 'decant' && av.sellsDecant;

    const amount = isDecant ? Number(product.priceDecant) : Number(product.price);
    const inStock = isDecant ? av.decant : av.full;
    const title = isDecant ? `${product.name} — Decant` : product.name;
    const presentacion = isDecant
      ? 'Decant (muestra). '
      : '';

    return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${CatalogService.escapeHtml(title)} — ${CatalogService.escapeHtml(catalogConfig.brand)}</title>
<meta property="og:title" content="${CatalogService.escapeHtml(title)}">
<meta property="og:type" content="product">
<meta property="product:price:amount" content="${amount.toFixed(2)}">
<meta property="product:price:currency" content="${catalogConfig.currency}">
<meta property="product:availability" content="${inStock ? 'in stock' : 'out of stock'}">
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
<h1>${CatalogService.escapeHtml(title)}</h1>
${product.imageUrl ? `<img src="${CatalogService.escapeHtml(product.imageUrl)}" alt="${CatalogService.escapeHtml(title)}">` : ''}
<p class="price">${CatalogService.formatPrice(amount)}</p>
<p class="stock">${inStock ? 'Disponible' : 'Agotado por ahora'}</p>
<p>${CatalogService.escapeHtml(presentacion + (product.description ?? ''))}</p>
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

  /** Genera la(s) fila(s) del feed para un producto: frasco y, si aplica, decant. */
  private static toRows(product: ProductWithInventory): FeedRow[] {
    const av = ProductsService.availability(product);
    const rows: FeedRow[] = [CatalogService.fullRow(product, av.full)];

    if (av.sellsDecant) {
      rows.push(CatalogService.decantRow(product, av.decant));
    }
    return rows;
  }

  /** Fila del frasco lleno. */
  private static fullRow(
    product: ProductWithInventory,
    inStock: boolean,
  ): FeedRow {
    const sku = product.inventory?.sku ?? product.slug;
    return {
      id: sku,
      title: product.name.slice(0, 200),
      description: (product.description ?? product.name).slice(0, 9999),
      availability: inStock ? 'in stock' : 'out of stock',
      condition: catalogConfig.condition,
      price: CatalogService.priceCol(Number(product.price)),
      link: `${catalogConfig.baseUrl}/p/${product.slug}`,
      image_link: product.imageUrl ?? '',
      brand: (product.brand ?? catalogConfig.brand).slice(0, 100),
    };
  }

  /** Fila del decant: mismo perfume, id/precio/enlace propios de la presentación. */
  private static decantRow(
    product: ProductWithInventory,
    inStock: boolean,
  ): FeedRow {
    const sku = product.inventory?.sku ?? product.slug;
    const desc = `Decant (muestra) de ${product.name}. ${product.description ?? ''}`;
    return {
      // id distinto del frasco: es otro producto en la tiendita.
      id: `${sku}-DECANT`,
      title: `${product.name} — Decant`.slice(0, 200),
      description: desc.slice(0, 9999),
      availability: inStock ? 'in stock' : 'out of stock',
      condition: catalogConfig.condition,
      price: CatalogService.priceCol(Number(product.priceDecant)),
      // La página muestra el precio del decant con ?v=decant, para que Meta no
      // detecte discrepancia entre el feed y la landing.
      link: `${catalogConfig.baseUrl}/p/${product.slug}?v=decant`,
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

  /** Precio para el feed: "289.00 PEN" (número, espacio, moneda; sin símbolo). */
  private static priceCol(amount: number): string {
    return `${amount.toFixed(2)} ${catalogConfig.currency}`;
  }

  /** Precio para mostrar en la landing: "S/ 289.00". */
  private static formatPrice(amount: number): string {
    const symbol = catalogConfig.currency === 'PEN' ? 'S/' : catalogConfig.currency;
    return `${symbol} ${amount.toFixed(2)}`;
  }
}
