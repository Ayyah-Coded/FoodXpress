import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsNumberString, IsOptional, IsString, IsUUID, MinLength, ValidateIf } from 'class-validator';


export class UpdateMenuItemDto {
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumberString()
  @IsOptional()
  price?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string; // set after UploadThing upload

  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean; // Owner can toggle availability
};