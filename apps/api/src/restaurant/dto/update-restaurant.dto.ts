import { IsBoolean, IsOptional, IsString, IsNotEmpty, IsUrl } from 'class-validator';

export class UpdateRestaurantDto {
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  name?: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  description?: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  address?: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  cuisineType?: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  @IsUrl()
  imageUrl?: string;

  @IsBoolean()
  @IsOptional()
  isOpen?: boolean;
}