import { LocationService } from './location.service';
import { NotFoundException } from '@nestjs/common';
import { UserRole } from '@food-xpress/types';
import * as schema from '../db/schema';

describe('LocationService', () => {
  const coordinates = { latitude: 12.34, longitude: 56.78 };

  function makeDb(order?: Partial<typeof schema.orders.$inferSelect>, restaurant?: any) {
    const db: any = {
      select: jest.fn(),
      from: jest.fn(),
      where: jest.fn(),
    };
    db.select.mockReturnValue(db);
    db.from.mockImplementation((table: unknown) => {
      db.where.mockImplementation(async () => {
        if (table === schema.orders) return order ? [order] : [];
        if (table === schema.restaurants) return restaurant ? [restaurant] : [];
        return [];
      });
      return db;
    });
    return db;
  }

  function makeRedis(location: unknown = coordinates) {
    const redis: any = {
      get: jest.fn().mockResolvedValue(
        location === null ? null : JSON.stringify(location),
      ),
    };
    return redis;
  }

  it('returns the driver location to the order customer', async () => {
    const redis = makeRedis();
    const db = makeDb({ id: 'order-1', customerId: 'cust-1', driverId: 'driver-1', restaurantId: 'r-1' });
    const service = new LocationService(redis, db);

    const result = await service.getAuthorizedDriverLocation('order-1', {
      sub: 'cust-1',
      role: UserRole.CUSTOMER,
    });

    expect(result).toEqual(coordinates);
    expect(redis.get).toHaveBeenCalledWith('driver:location:order-1');
  });

  it('returns the driver location to the assigned driver', async () => {
    const redis = makeRedis();
    const db = makeDb({ id: 'order-1', customerId: 'cust-1', driverId: 'driver-1', restaurantId: 'r-1' });
    const service = new LocationService(redis, db);

    const result = await service.getAuthorizedDriverLocation('order-1', {
      sub: 'driver-1',
      role: UserRole.DRIVER,
    });

    expect(result).toEqual(coordinates);
  });

  it('returns the driver location to the restaurant owner', async () => {
    const redis = makeRedis();
    const db = makeDb(
      { id: 'order-1', customerId: 'cust-1', driverId: 'driver-1', restaurantId: 'r-1' },
      { id: 'r-1', ownerId: 'owner-1' },
    );
    const service = new LocationService(redis, db);

    const result = await service.getAuthorizedDriverLocation('order-1', {
      sub: 'owner-1',
      role: UserRole.RESTAURANT_OWNER,
    });

    expect(result).toEqual(coordinates);
  });

  it('throws NotFoundException for an unrelated customer', async () => {
    const redis = makeRedis();
    const db = makeDb({ id: 'order-1', customerId: 'cust-1', driverId: 'driver-1', restaurantId: 'r-1' });
    const service = new LocationService(redis, db);

    await expect(
      service.getAuthorizedDriverLocation('order-1', {
        sub: 'other-cust',
        role: UserRole.CUSTOMER,
      }),
    ).rejects.toThrow(NotFoundException);
    expect(redis.get).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the owner does not own the restaurant', async () => {
    const redis = makeRedis();
    const db = makeDb(
      { id: 'order-1', customerId: 'cust-1', driverId: 'driver-1', restaurantId: 'r-1' },
      { id: 'r-2', ownerId: 'owner-1' },
    );
    const service = new LocationService(redis, db);

    await expect(
      service.getAuthorizedDriverLocation('order-1', {
        sub: 'owner-1',
        role: UserRole.RESTAURANT_OWNER,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when the order does not exist', async () => {
    const redis = makeRedis();
    const db = makeDb();
    const service = new LocationService(redis, db);

    await expect(
      service.getAuthorizedDriverLocation('order-1', {
        sub: 'cust-1',
        role: UserRole.CUSTOMER,
      }),
    ).rejects.toThrow(NotFoundException);
    expect(redis.get).not.toHaveBeenCalled();
  });
});