import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import type { Prisma } from '@prisma/client';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';

@Controller('inventory')
@UseGuards(AdminAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  getInventory(): Promise<
    Prisma.InventoryGetPayload<{ include: { product: true } }>[]
  > {
    return this.inventoryService.getInventory();
  }

  @Patch(':productId')
  adjust(
    @Param('productId') productId: string,
    @Body() dto: AdjustInventoryDto,
  ) {
    return this.inventoryService.adjust(productId, dto);
  }
}
