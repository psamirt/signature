import { IsInt, IsOptional, Min } from 'class-validator';

/** Corrección manual de stock, valores absolutos (no delta). */
export class AdjustInventoryDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  sealedUnits?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  openDecants?: number;
}
