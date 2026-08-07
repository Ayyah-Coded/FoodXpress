import { Transform } from 'class-transformer/types/decorators/transform.decorator';
import { IsNotEmpty, IsNumberString, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';


export class CreateMenuItemDto {
  @IsUUID()
  categoryId!: string;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
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