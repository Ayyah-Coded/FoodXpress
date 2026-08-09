import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema';
import { and, eq } from 'drizzle-orm';
import { DriverLocation } from '../db/schema/locations';


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
    const [activeOrder] = await this.db
      .select()
      .from(schema.orders)
      .where(and(
        eq(schema.orders.id, orderId),
        eq(schema.orders.driverId, driverId),
      ));

    if (!activeOrder) {
      throw new NotFoundException('Active order assignment not found');
    }

    return this.db
      .insert(schema.driverLocations)
      .values({
        driverId,
        orderId,
        latitude: latitude.toFixed(7),
        longitude: longitude.toFixed(7),
      })
      .onConflictDoUpdate({
        target: schema.driverLocations.orderId,
        set: {
          driverId,
          latitude: latitude.toFixed(7),
          longitude: longitude.toFixed(7),
          updatedAt: new Date(),
        },
      })
      .returning();
  }

  async getDriverLocation(orderId: string): Promise<DriverLocation | null> {
    const [location] = await this.db
      .select()
      .from(schema.driverLocations)
      .where(eq(schema.driverLocations.orderId, orderId))
      .limit(1);

    return location ?? null;
  }
}
