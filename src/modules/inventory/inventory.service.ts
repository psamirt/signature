import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '@prisma/client';
import type { AdjustInventoryDto } from './dto/adjust-inventory.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  getInventory(): Promise<
    Prisma.InventoryGetPayload<{ include: { product: true } }>[]
  > {
    return this.prisma.inventory.findMany({
      include: { product: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /** Corrección manual de stock (set absoluto), para ajustes tras conteo físico. */
  adjust(productId: string, dto: AdjustInventoryDto) {
    return this.prisma.inventory.update({
      where: { productId },
      data: dto,
    });
  }
}
