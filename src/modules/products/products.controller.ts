import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import type { Prisma } from '@prisma/client';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('products')
@UseGuards(AdminAuthGuard)
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

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string): Promise<void> {
    return this.productsService.remove(id);
  }
}
