import { OrdersService } from './orders.service';
import { UserRole } from '@food-xpress/types';

describe('OrdersService', () => {
  it('does not fail the READY transition when driver assignment rejects', async () => {
    const order = {
      id: 'order-1',
      customerId: 'customer-1',
      restaurantId: 'restaurant-1',
      status: 'PREPARING',
      updatedAt: new Date(),
    };

    const restaurant = { id: 'restaurant-1', ownerId: 'owner-1' };

    const tx = {
      update: jest.fn().mockImplementation(() => ({
        set: jest.fn().mockImplementation(() => ({
          where: jest.fn().mockImplementation(() => ({
            returning: jest.fn().mockResolvedValue([order]),
          })),
        })),
      })),
      insert: jest.fn().mockImplementation(() => ({
        values: jest.fn().mockResolvedValue([{ id: 'event-1' }]),
      })),
    };

    const db: any = {
      select: jest.fn()
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([order]),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([restaurant]),
          }),
        }),
      transaction: jest.fn(async (callback) => callback(tx)),
    };

    const driverService = {
      assignDriver: jest.fn().mockRejectedValue(new Error('driver assignment failed')),
    };

    const ordersGateway = {
      emitOrderUpdate: jest.fn(),
    };

    const service = new OrdersService(db, ordersGateway as any, driverService as any);

    await expect(
      service.updateStatus('order-1', 'READY' as any, {
        sub: 'owner-1',
        role: UserRole.RESTAURANT_OWNER,
      }),
    ).resolves.toMatchObject({ id: 'order-1' });
  });
});
