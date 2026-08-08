import { IsInt, IsOptional, IsString, Min } from 'class-validator';

/** Datos de inventario embebidos en la creación/edición de un producto. */
export class InventoryInputDto {
  @IsString()
  sku: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sealedUnits?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  openDecants?: number;
}

export class InventoryPatchDto {
  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sealedUnits?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  openDecants?: number;
}
