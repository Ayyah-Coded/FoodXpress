import { IsBoolean, IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';


export class UpdateMenuItemDto {
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
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