import { IsBoolean, IsOptional, IsString, IsNotEmpty, IsUrl, Matches } from 'class-validator';

export class UpdateRestaurantDto {
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'name must contain non-whitespace characters' })
  name?: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'description must contain non-whitespace characters' })
  description?: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'address must contain non-whitespace characters' })
  address?: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'cuisineType must contain non-whitespace characters' })
  cuisineType?: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  @IsUrl()
  @Matches(/\S/, { message: 'imageUrl must contain non-whitespace characters' })
  imageUrl?: string;

  @IsBoolean()
  @IsOptional()
  isOpen?: boolean;
}