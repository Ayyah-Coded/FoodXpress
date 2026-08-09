import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';

const REDIS_HOST = process.env.REDIS_HOST ?? '127.0.0.1';
const REDIS_PORT = Number(process.env.REDIS_PORT ?? 6379);

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS',
      useFactory: () => {
        const client = new Redis({
          host: REDIS_HOST,
          port: REDIS_PORT,
          lazyConnect: true,
        });

        client.on('error', (error) => {
          console.error('Unexpected Redis error', error);
        });

        // ioredis auto-connects after instantiation (lazyConnect only delays
        // the connection to the first command, but connecting explicitly lets
        // us surface connection failures immediately at boot).
        client.connect().catch((error) => {
          console.error('Failed to connect to Redis', error);
        });

        return client;
      },
    },
  ],
  exports: ['REDIS'],
})

export class RedisModule {}