import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

/**
 * Comprueba la cadena de conexión antes de intentar nada. Es fácil que el shell
 * la mutile: las cadenas de Neon llevan `&channel_binding=require`, y en
 * PowerShell `&` parte el comando si no se usan comillas SIMPLES.
 */
function resolveConnectionString(): string {
  const raw = process.env.DATABASE_URL;

  if (!raw) {
    console.error(
      'DATABASE_URL no está definida.\n\n' +
        "PowerShell:  $env:DATABASE_URL='postgresql://...'; pnpm db:seed\n" +
        "Bash:        DATABASE_URL='postgresql://...' pnpm db:seed\n\n" +
        'Usa comillas SIMPLES: la cadena lleva & y ? que el shell interpreta.',
    );
    process.exit(1);
  }

  let host: string;
  try {
    host = new URL(raw).hostname;
  } catch {
    console.error(
      `DATABASE_URL no es una URL válida: "${raw.slice(0, 40)}…"\n` +
        'Lo más probable es que el shell la haya cortado. Usa comillas simples.',
    );
    process.exit(1);
  }

  // Un host sin puntos y que no sea localhost delata una cadena truncada,
  // p. ej. "base" cuando el shell cortó en el primer &.
  if (!host.includes('.') && host !== 'localhost') {
    console.error(
      `El host de la conexión es "${host}", lo cual no parece correcto.\n` +
        'La cadena llegó cortada: envuélvela en comillas SIMPLES.',
    );
    process.exit(1);
  }

  // Los ejemplos de la documentación llevan hosts de relleno. Es fácil pegar la
  // cadena de muestra y cambiar sólo el usuario y la clave.
  if (/ep-xxx|tu-app|usuario:clave|ejemplo\./i.test(raw)) {
    console.error(
      `El host "${host}" es un placeholder de la documentación, no tu servidor real.\n\n` +
        'Copia la cadena completa desde el panel de Neon (Connection string) o\n' +
        'desde Render > Environment > DATABASE_URL.',
    );
    process.exit(1);
  }

  console.log(`Sembrando en: ${host}\n`);
  return raw;
}

const connectionString = resolveConnectionString();

const pool = new Pool({
  connectionString,
  ssl: /sslmode=(require|verify-ca|verify-full)/.test(connectionString)
    ? { rejectUnauthorized: true }
    : undefined,
  connectionTimeoutMillis: 15_000,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

interface SeedProduct {
  slug: string;
  name: string;
  description: string;
  /** Precio del frasco lleno. */
  price: string;
  /** Precio de un decant. Omitir si el perfume no se decanta. */
  priceDecant?: string;
  /** Cuántos decants salen de un frasco. Omitir si no se decanta. */
  decantsPerBottle?: number;
  category: string;
  sku: string;
  /** Frascos sellados en stock. */
  sealedUnits: number;
  /** Decants sueltos de frascos ya abiertos. Por defecto 0. */
  openDecants?: number;
  /** URL absoluta de la foto. Obligatoria para que el producto entre al feed de Meta. */
  imageUrl?: string;
  brand?: string;
}

/**
 * Imagen de relleno de 800x800 con el nombre del producto rotulado.
 *
 * A propósito NO se usan URLs de Google Imágenes: las miniaturas de
 * `gstatic.com` rondan los 200 px (Meta exige mínimo 500x500 y rechaza la
 * imagen), las URLs caducan, y son fotos de producto de terceros — usarlas en
 * un catálogo comercial es un problema de derechos y viola las políticas de
 * comercio de Meta, que exigen que la imagen represente lo que realmente vendes.
 *
 * Estas sirven para probar el feed de punta a punta. Sustitúyelas por fotos
 * tuyas antes de activar anuncios.
 */
function placeholderImage(name: string): string {
  const label = encodeURIComponent(name);
  return `https://placehold.co/800x800/1a1a1a/f4f1ea.png?text=${label}`;
}

// Meta pide al menos 5 productos para habilitar los anuncios de catálogo
// Advantage+; van 6 para tener margen si alguno se desactiva.
const PRODUCTS: SeedProduct[] = [
  {
    slug: 'noir-intense',
    name: 'Noir Intense',
    description:
      'Eau de parfum ámbar y madera, 100 ml. Notas de bergamota, cuero y sándalo. Proyección alta y duración de 8 a 10 horas.',
    price: '289.00',
    priceDecant: '45.00',
    decantsPerBottle: 9,
    category: 'hombre',
    sku: 'SIG-NOI-100',
    sealedUnits: 12,
    imageUrl: placeholderImage('Noir Intense'),
  },
  {
    slug: 'blossom-eau-de-parfum',
    name: 'Blossom',
    description:
      'Floral blanco con notas de jazmín, pera y almizcle, 50 ml. Fresco y ligero, ideal para uso diario.',
    price: '219.00',
    priceDecant: '35.00',
    decantsPerBottle: 5,
    category: 'mujer',
    sku: 'SIG-BLO-050',
    sealedUnits: 7,
    imageUrl: placeholderImage('Blossom'),
  },
  {
    slug: 'oud-royale',
    name: 'Oud Royale',
    description:
      'Oud, azafrán y rosa de Damasco, 75 ml. Edición limitada de nuestra línea premium, con notas de fondo de ámbar y vainilla.',
    price: '540.00',
    priceDecant: '75.00',
    decantsPerBottle: 7,
    category: 'unisex',
    sku: 'SIG-OUD-075',
    sealedUnits: 3,
    imageUrl: placeholderImage('Oud Royale'),
  },
  {
    slug: 'citrus-fresh',
    name: 'Citrus Fresh',
    description:
      'Bergamota, limón de Amalfi y vetiver, 100 ml. Cítrico luminoso para el día, con estela discreta.',
    price: '175.00',
    priceDecant: '30.00',
    decantsPerBottle: 9,
    category: 'unisex',
    sku: 'SIG-CIT-100',
    // Frascos agotados pero con decants sueltos: prueba el "solo en decant".
    sealedUnits: 0,
    openDecants: 4,
    imageUrl: placeholderImage('Citrus Fresh'),
  },
  {
    slug: 'vanille-absolue',
    name: 'Vanille Absolue',
    description:
      'Vainilla de Madagascar, haba tonka y praliné, 50 ml. Gourmand envolvente, especial para las noches frías.',
    price: '265.00',
    // Este solo se vende en frasco (sin decant): prueba ese caso.
    category: 'mujer',
    sku: 'SIG-VAN-050',
    sealedUnits: 9,
    imageUrl: placeholderImage('Vanille Absolue'),
  },
  {
    slug: 'marine-bleu',
    name: 'Marine Bleu',
    description:
      'Acuático con notas de salvia, menta y musgo marino, 100 ml. Limpio y versátil, pensado para la oficina.',
    price: '198.00',
    priceDecant: '32.00',
    decantsPerBottle: 9,
    category: 'hombre',
    sku: 'SIG-MAR-100',
    sealedUnits: 15,
    imageUrl: placeholderImage('Marine Bleu'),
  },
];

async function main() {
  let sinImagen = 0;

  for (const item of PRODUCTS) {
    const data = {
      name: item.name,
      description: item.description,
      price: item.price,
      priceDecant: item.priceDecant ?? null,
      decantsPerBottle: item.decantsPerBottle ?? null,
      category: item.category,
      // imageUrl queda en null hasta que subas fotos reales: Meta exige
      // image_link (JPEG/PNG, mínimo 500x500 px) y rechaza la fila sin ella.
      imageUrl: item.imageUrl ?? null,
      brand: item.brand ?? null,
    };

    const product = await prisma.product.upsert({
      where: { slug: item.slug },
      update: data,
      create: { slug: item.slug, ...data },
    });

    const stock = {
      sealedUnits: item.sealedUnits,
      openDecants: item.openDecants ?? 0,
    };

    await prisma.inventory.upsert({
      where: { productId: product.id },
      update: stock,
      create: { productId: product.id, sku: item.sku, ...stock },
    });

    if (!item.imageUrl) sinImagen++;
    console.log(
      `✔ ${item.name} (frascos ${stock.sealedUnits}, decants sueltos ${stock.openDecants})${item.imageUrl ? '' : '  — sin imagen'}`,
    );
  }

  if (sinImagen) {
    console.log(
      `\n⚠  ${sinImagen} producto(s) sin imageUrl quedan fuera del feed de Meta.\n` +
        '   Revisa /catalog/status para ver la lista y qué le falta a cada uno.',
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
