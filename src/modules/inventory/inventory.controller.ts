import { Controller, Get } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import type { Prisma } from '@prisma/client';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  getInventory(): Promise<
    Prisma.InventoryGetPayload<{ include: { product: true } }>[]
  > {
    return this.inventoryService.getInventory();
  }
}
