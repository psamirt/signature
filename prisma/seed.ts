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

const PRODUCTS = [
  {
    slug: 'noir-intense',
    name: 'Noir Intense',
    description: 'Eau de parfum ámbar y madera, 100 ml. Proyección alta.',
    price: '289.00',
    category: 'hombre',
    sku: 'SIG-NOI-100',
    stock: 12,
  },
  {
    slug: 'blossom-eau-de-parfum',
    name: 'Blossom',
    description: 'Floral blanco con notas de jazmín y pera, 50 ml.',
    price: '219.00',
    category: 'mujer',
    sku: 'SIG-BLO-050',
    stock: 7,
  },
  {
    slug: 'oud-royale',
    name: 'Oud Royale',
    description: 'Oud, azafrán y rosa. Edición limitada, 75 ml.',
    price: '540.00',
    category: 'unisex',
    sku: 'SIG-OUD-075',
    stock: 3,
  },
  {
    slug: 'citrus-fresh',
    name: 'Citrus Fresh',
    description: 'Bergamota y vetiver, ideal para el día, 100 ml.',
    price: '175.00',
    category: 'unisex',
    sku: 'SIG-CIT-100',
    stock: 0,
  },
];

async function main() {
  for (const item of PRODUCTS) {
    const product = await prisma.product.upsert({
      where: { slug: item.slug },
      update: {
        name: item.name,
        description: item.description,
        price: item.price,
        category: item.category,
      },
      create: {
        slug: item.slug,
        name: item.name,
        description: item.description,
        price: item.price,
        category: item.category,
      },
    });

    await prisma.inventory.upsert({
      where: { productId: product.id },
      update: { stock: item.stock },
      create: { productId: product.id, sku: item.sku, stock: item.stock },
    });

    console.log(`✔ ${item.name} (stock ${item.stock})`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
