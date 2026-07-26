import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
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
