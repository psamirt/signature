import 'dotenv/config';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString = process.env.DATABASE_URL ?? '';

    const pool = new Pool({
      connectionString,
      // Los Postgres gestionados (Neon, Render, Supabase) exigen TLS y traen
      // certificados válidos. En local no hay TLS, de ahí la distinción.
      ssl: /sslmode=(require|verify-ca|verify-full)/.test(connectionString)
        ? { rejectUnauthorized: true }
        : undefined,
      // Neon suspende el cómputo tras ~5 min de inactividad; la primera consulta
      // después de eso tarda en despertar la instancia.
      connectionTimeoutMillis: 15_000,
    });

    const adapter = new PrismaPg(pool);

    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
