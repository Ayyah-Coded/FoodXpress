import { IsOptional, IsString } from 'class-validator';

export class CreateRestaurantDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  address!: string;

  @IsString()
  cuisineType!: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;
}