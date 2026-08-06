import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '@prisma/client';

export type ProductWithInventory = Prisma.ProductGetPayload<{
  include: { inventory: true };
}>;

/** Disponibilidad derivada, en booleanos: nunca exponemos las cantidades. */
export interface Availability {
  /** Hay al menos un frasco sellado para vender entero. */
  full: boolean;
  /** Este perfume se ofrece en decants (tiene precio y rendimiento por frasco). */
  sellsDecant: boolean;
  /** Se puede entregar un decant: hay sueltos o un frasco sellado que abrir. */
  decant: boolean;
}

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

  /** Productos activos con algo que vender: frasco sellado o decants sueltos. */
  findAvailable(take = 8): Promise<ProductWithInventory[]> {
    return this.prisma.product.findMany({
      where: {
        active: true,
        inventory: {
          OR: [{ sealedUnits: { gt: 0 } }, { openDecants: { gt: 0 } }],
        },
      },
      include: { inventory: true },
      orderBy: { name: 'asc' },
      take,
    });
  }

  /**
   * Todos los productos activos para pasárselos como contexto al agente de IA.
   * Incluye los agotados para que el bot pueda decir "agotado" en vez de inventar.
   */
  findForAgent(take = 100): Promise<ProductWithInventory[]> {
    return this.prisma.product.findMany({
      where: { active: true },
      include: { inventory: true },
      orderBy: { name: 'asc' },
      take,
    });
  }

  /**
   * Vende `qty` frascos llenos: sólo descuenta de los sellados.
   * Devuelve el inventario actualizado.
   */
  async sellFull(productId: string, qty = 1) {
    if (qty < 1) throw new BadRequestException('La cantidad debe ser ≥ 1.');

    return this.prisma.$transaction(async (tx) => {
      const inv = await tx.inventory.findUnique({ where: { productId } });
      if (!inv) throw new BadRequestException('Producto sin inventario.');
      if (inv.sealedUnits < qty) {
        throw new BadRequestException(
          `Sólo quedan ${inv.sealedUnits} frasco(s) sellado(s).`,
        );
      }
      return tx.inventory.update({
        where: { productId },
        data: { sealedUnits: inv.sealedUnits - qty },
      });
    });
  }

  /**
   * Vende `qty` decants. Si no hay decants sueltos suficientes, abre tantos
   * frascos sellados como haga falta (cada uno rinde `decantsPerBottle`).
   * Es justo la regla del negocio: usar un frasco para decants ya no lo deja
   * vendible como frasco grande.
   */
  async sellDecant(productId: string, qty = 1) {
    if (qty < 1) throw new BadRequestException('La cantidad debe ser ≥ 1.');

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        include: { inventory: true },
      });
      const inv = product?.inventory;
      const per = product?.decantsPerBottle ?? 0;

      if (!product || !inv)
        throw new BadRequestException('Producto sin inventario.');
      if (per < 1) {
        throw new BadRequestException('Este perfume no se vende en decants.');
      }

      let { sealedUnits, openDecants } = inv;

      // Abre frascos sellados hasta juntar los decants necesarios.
      while (openDecants < qty && sealedUnits > 0) {
        sealedUnits -= 1;
        openDecants += per;
      }

      if (openDecants < qty) {
        throw new BadRequestException(
          'No hay stock suficiente para tantos decants.',
        );
      }

      return tx.inventory.update({
        where: { productId },
        data: { sealedUnits, openDecants: openDecants - qty },
      });
    });
  }

  /** Disponibilidad en booleanos, sin exponer cantidades. */
  static availability(product: ProductWithInventory): Availability {
    const sealed = product.inventory?.sealedUnits ?? 0;
    const open = product.inventory?.openDecants ?? 0;
    const sellsDecant =
      (product.decantsPerBottle ?? 0) > 0 && product.priceDecant != null;

    return {
      full: sealed > 0,
      sellsDecant,
      // Se puede dar un decant si hay sueltos, o un sellado que abrir.
      decant: sellsDecant && (open > 0 || sealed > 0),
    };
  }
}
