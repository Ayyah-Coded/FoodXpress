import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';


@Injectable()
export class LocationService {
  constructor(
    @Inject('DB') private db: NodePgDatabase<typeof schema>,
  ) {}

  async saveDriverLocation(
    driverId: string,
    orderId: string,
    latitude: number,
    longitude: number,
  ) {
    const [existing] = await this.db
      .select()
      .from(schema.driverLocations)
      .where(eq(schema.driverLocations.orderId, orderId));

    if (existing) {
      return this.db
        .update(schema.driverLocations)
        .set({
          latitude: latitude.toFixed(7),
          longitude: longitude.toFixed(7),
          updatedAt: new Date(),
        })
        .where(eq(schema.driverLocations.orderId, orderId))
        .returning();
    }

    return this.db
      .insert(schema.driverLocations)
      .values({
        driverId,
        orderId,
        latitude: latitude.toFixed(7),
        longitude: longitude.toFixed(7),
      })
      .returning();
  }
}