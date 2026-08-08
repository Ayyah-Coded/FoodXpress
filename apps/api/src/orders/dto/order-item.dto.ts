import { Type } from 'class-transformer/types/decorators/type.decorator';
import { IsInt, IsUUID, Min } from 'class-validator';


export class OrderItemDto {
  @IsUUID()
  menuItemId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
};