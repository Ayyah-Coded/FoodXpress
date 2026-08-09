import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../redis/redis.module';
import { LocationService } from './location.service';
import { LocationController } from './location.controller';


@Module({
  imports: [AuthModule, RedisModule],
  providers: [LocationService],
  controllers: [LocationController],
  exports: [LocationService],
})

export class LocationModule {}