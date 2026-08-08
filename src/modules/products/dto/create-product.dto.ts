import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  ValidateNested,
} from 'class-validator';
import { InventoryInputDto } from './inventory-input.dto';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsOptional()
  @IsString()
  description?: string;

  /** Precio del frasco lleno. Como string para no perder precisión decimal. */
  @IsNumberString()
  price: string;

  @IsOptional()
  @IsNumberString()
  priceDecant?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  decantsPerBottle?: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ValidateNested()
  @Type(() => InventoryInputDto)
  inventory: InventoryInputDto;
}
