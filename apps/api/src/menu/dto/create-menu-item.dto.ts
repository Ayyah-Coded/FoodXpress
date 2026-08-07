import { IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';


export class CreateMenuItemDto {
  @IsUUID()
  categoryId!: string;

  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumberString() // price comes as a string e.g. "8.99" — matches numeric DB type
  price!: string;

  @IsString()
  @IsOptional()
  imageUrl?: string; // set after UploadThing upload
};