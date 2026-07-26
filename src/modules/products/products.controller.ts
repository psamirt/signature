import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import type { Prisma } from '@prisma/client';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(@Query('category') category?: string): Promise<
    Prisma.ProductGetPayload<{
      include: { inventory: true };
    }>[]
  > {
    return this.productsService.findAll(category);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Prisma.ProductGetPayload<{
    include: { inventory: true };
  }> | null> {
    return this.productsService.findOne(id);
  }
}
