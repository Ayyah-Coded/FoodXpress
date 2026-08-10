import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { AuthModule } from '../auth/auth.module';
import { Module } from '@nestjs/common';


@Module({
  imports: [AuthModule],
  providers: [ReviewsService],
  controllers: [ReviewsController],
  exports: [ReviewsService],
})

export class ReviewsModule {}