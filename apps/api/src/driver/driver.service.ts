import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { OrdersGateway } from '../gateway/orders.gateway';
import { UserRole } from '@food-xpress/types';
import * as schema from '../db/schema';
import { and, eq, ne } from 'drizzle-orm';


@Injectable()
export class DriverService {
  constructor(
    @Inject('DB') private db: NodePgDatabase<typeof schema>,
    private ordersGateway: OrdersGateway,
  ) {}

  async toggleOnline(driverId: string) {
    const [driver] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, driverId));

    if (!driver) throw new NotFoundException('Driver not found');

    const [updated] = await this.db
      .update(schema.users)
      .set({ isOnline: !driver.isOnline })
      .where(eq(schema.users.id, driverId))
      .returning();

    return { isOnline: updated.isOnline };
  };

  async getStatus(driverId: string) {
    const [driver] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, driverId));

    if (!driver) throw new NotFoundException('Driver not found');
    return { isOnline: driver.isOnline };
  };

  async assignDriver(orderId: string) {
    const [driver] = await this.db
      .select()
      .from(schema.users)
      .where(
        and(
          eq(schema.users.role, UserRole.DRIVER),
          eq(schema.users.isOnline, true),
        ),
      );

    if (!driver) {
      console.log('No online drivers available for order:', orderId);
      return null; // order stays READY, no driverId
    }

    const [updatedOrder] = await this.db
      .update(schema.orders)
      .set({ driverId: driver.id, updatedAt: new Date() })
      .where(eq(schema.orders.id, orderId))
      .returning();

    // push to driver:<driverId> room — driver app shows incoming order modal
    this.ordersGateway.emitDriverAssigned(driver.id, updatedOrder);

    return updatedOrder;
  };

  async declineOrder(orderId: string, driverId: string) {
    return this.db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, orderId));

      if (!order) throw new NotFoundException('Order not found');
      if (order.driverId !== driverId) {
        throw new NotFoundException('Order not found');
      }

      // guard the predicate with driverId and status so a stale decline (a
      // request that read the order before it was reassigned) cannot wipe out
      // the new driver's assignment, and a decline cannot clear or reassign a
      // PICKED_UP or DELIVERED order
      const [cleared] = await tx
        .update(schema.orders)
        .set({ driverId: null, updatedAt: new Date() })
        .where(
          and(
            eq(schema.orders.id, orderId),
            eq(schema.orders.driverId, driverId),
            eq(schema.orders.status, 'READY'),
          ),
        )
        .returning();

      if (!cleared) {
        // zero rows updated => another request already reassigned this order;
        // treat as a conflict
        throw new NotFoundException('Order not found');
      }

      // find another online driver, inside the same transaction, excluding
      // the declining driver so the order is not immediately reassigned to
      // the same driver who just declined it
      const [driver] = await tx
        .select()
        .from(schema.users)
        .where(
          and(
            eq(schema.users.role, UserRole.DRIVER),
            eq(schema.users.isOnline, true),
            ne(schema.users.id, driverId),
          ),
        );

      if (!driver) {
        console.log('No online drivers available for order:', orderId);
        return { message: 'Order declined' };
      }

      const [updatedOrder] = await tx
        .update(schema.orders)
        .set({ driverId: driver.id, updatedAt: new Date() })
        .where(eq(schema.orders.id, orderId))
        .returning();

      // push to driver:<driverId> room — driver app shows incoming order modal
      this.ordersGateway.emitDriverAssigned(driver.id, updatedOrder);

      return { message: 'Order declined' };
    });
  };
};