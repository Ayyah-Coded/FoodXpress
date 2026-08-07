import { IsOptional, IsString, IsNotEmpty, IsUrl } from 'class-validator';

export class CreateRestaurantDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  description?: string;

  @IsString()
  @IsNotEmpty()
  address!: string;

  @IsString()
  @IsNotEmpty()
  cuisineType!: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  @IsUrl()
  imageUrl?: string;
}