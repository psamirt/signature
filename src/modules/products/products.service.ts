import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '@prisma/client';

export type ProductWithInventory = Prisma.ProductGetPayload<{
  include: { inventory: true };
}>;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(category?: string): Promise<ProductWithInventory[]> {
    return this.prisma.product.findMany({
      where: category ? { category } : undefined,
      include: { inventory: true },
    });
  }

  findOne(id: string): Promise<ProductWithInventory | null> {
    return this.prisma.product.findUnique({
      where: { id },
      include: { inventory: true },
    });
  }

  /** Búsqueda difusa por nombre, descripción o categoría. La usa el bot. */
  search(term: string, take = 5): Promise<ProductWithInventory[]> {
    const query = term.trim();
    if (!query) return Promise.resolve([]);

    return this.prisma.product.findMany({
      where: {
        active: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { category: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: { inventory: true },
      take,
    });
  }

  /** Sólo productos activos con stock, para el catálogo que ve el cliente. */
  findAvailable(take = 8): Promise<ProductWithInventory[]> {
    return this.prisma.product.findMany({
      where: { active: true, inventory: { stock: { gt: 0 } } },
      include: { inventory: true },
      orderBy: { name: 'asc' },
      take,
    });
  }

  /**
   * Todos los productos activos (con o sin stock) para pasárselos como contexto
   * al agente de IA. Incluye los agotados para que el bot pueda decir "agotado"
   * en vez de inventar que no existe.
   */
  findForAgent(take = 100): Promise<ProductWithInventory[]> {
    return this.prisma.product.findMany({
      where: { active: true },
      include: { inventory: true },
      orderBy: { name: 'asc' },
      take,
    });
  }
}
