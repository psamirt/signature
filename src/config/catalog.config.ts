/**
 * Datos del feed de catálogo que consume el Administrador de ventas de Meta.
 * Referencia de campos: developers.facebook.com/docs/commerce-platform/catalog/fields
 */
export const catalogConfig = {
  /** Marca por defecto cuando el producto no trae una propia. */
  brand: process.env.CATALOG_BRAND ?? 'Aura Signature',

  /** Código ISO de la moneda. El precio va como "289.00 PEN". */
  currency: process.env.CATALOG_CURRENCY ?? 'PEN',

  /**
   * URL pública de esta API, sin barra final. Se usa para construir los enlaces
   * absolutos del feed: Meta exige que `link` esté en tu propio dominio y
   * rastrea esa página para comparar precio y disponibilidad con el feed.
   */
  get baseUrl(): string {
    const raw =
      process.env.PUBLIC_BASE_URL ?? 'https://signature-api-x65k.onrender.com';
    return raw.replace(/\/+$/, '');
  },

  /** Condición declarada para todos los productos: new | refurbished | used. */
  condition: process.env.CATALOG_CONDITION ?? 'new',

  /**
   * Credenciales opcionales para el feed (HTTP Basic). Vacías = feed público.
   * Si las defines, hay que poner las mismas en el Administrador de ventas.
   */
  get feedAuth(): { user: string; password: string } {
    return {
      user: process.env.CATALOG_FEED_USER ?? '',
      password: process.env.CATALOG_FEED_PASSWORD ?? '',
    };
  },
};
