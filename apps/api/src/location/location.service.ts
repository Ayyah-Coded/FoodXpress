import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Redis } from 'ioredis';
import { UserRole } from '@food-xpress/types';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';


export interface DriverCoordinates {
  latitude: number;
  longitude: number;
};

function isDriverCoordinates(value: unknown): value is DriverCoordinates {
  return (
    typeof value === 'object' &&
    value !== null &&
    'latitude' in value &&
    'longitude' in value &&
    typeof value.latitude === 'number' &&
    typeof value.longitude === 'number'
  );
};

@Injectable()
export class LocationService {
  constructor(
    @Inject('REDIS') private readonly redis: Redis,
    @Inject('DB') private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async saveDriverLocation(
    orderId: string, latitude: number, longitude: number,
  ) {
    const key = `driver:location:${orderId}`;
    await this.redis.set(
      key,
      JSON.stringify({ latitude, longitude }),
      'EX',
      3600,
    );
  };

  // GET /location/:orderId — customer hydrates map before first live tick
  async getDriverLocation(orderId: string): Promise<DriverCoordinates | null> {
    const key = `driver:location:${orderId}`;
    const data = await this.redis.get(key);
    if (!data) return null;

    const parsed: unknown = typeof data === 'string' ? JSON.parse(data) : data;

    return isDriverCoordinates(parsed) ? parsed : null;
  };

  // Authorized variant for the HTTP endpoint. Mirrors OrdersService.findById's
  // role-aware access control so a caller can only retrieve the driver's
  // location for an order they are involved in (customer, assigned driver, or
  // owning restaurant).
  async getAuthorizedDriverLocation(
    orderId: string,
    user: { sub: string; role: string },
  ): Promise<DriverCoordinates | null> {
    await this.authorizeOrder(orderId, user);
    return this.getDriverLocation(orderId);
  };

  private async authorizeOrder(
    orderId: string,
    user: { sub: string; role: string },
  ): Promise<void> {
    const [order] = await this.db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId));

    if (!order) throw new NotFoundException('Order not found');

    // each role can only access orders they're involved in; the same
    // NotFoundException is thrown regardless so we don't leak whether the
    // order exists — consistent with OrdersService.findById
    const canView =
      (user.role === UserRole.CUSTOMER && order.customerId === user.sub) ||
      (user.role === UserRole.RESTAURANT_OWNER &&
        (await this.isOwnerOfRestaurant(user.sub, order.restaurantId))) ||
      (user.role === UserRole.DRIVER && order.driverId === user.sub);

    if (!canView) throw new NotFoundException('Order not found');
  }

  private async isOwnerOfRestaurant(ownerId: string, restaurantId: string) {
    const [restaurant] = await this.db
      .select()
      .from(schema.restaurants)
      .where(eq(schema.restaurants.ownerId, ownerId));

    return restaurant?.id === restaurantId;
  }
};