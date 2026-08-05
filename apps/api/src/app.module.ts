import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DbModule, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
