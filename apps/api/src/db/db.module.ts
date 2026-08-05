import { Pool } from 'pg';
import * as schema from './schema';
import { Global, Module } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';

@Global()
@Module({
  providers: [
    {
      provide: 'DB',
      useFactory: () => {
        const pool = new Pool({
          connectionString: process.env.DATABASE_URL!,
        });

        pool.on('error', (error) => {
          console.error('Unexpected PostgreSQL pool error', error);
        });

        return drizzle(pool, { schema });
      },
    },
  ],
  exports: ['DB'],
})
export class DbModule {}