import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '@prisma/client';

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
}
