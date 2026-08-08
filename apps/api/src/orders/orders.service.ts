import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, UserRole } from '@food-xpress/types';
import { CreateOrderDto } from './dto/create-order.dto';
import { desc, eq, inArray, SQL } from 'drizzle-orm';
import * as schema from '../db/schema';
import { OrdersGateway } from '../gateway/orders.gateway';
import { DriverService } from '../driver/driver.service';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

@Injectable()
export class OrdersService {
  constructor(
    @Inject('DB') private db: NodePgDatabase<typeof schema>,
    private ordersGateway: OrdersGateway,
    private driverService: DriverService,
  ) {}

  async create(customerId: string, dto: CreateOrderDto) {
    const menuItemIds = [... new Set(dto.items.map((i) => i.menuItemId))];

    // fetch all menu items in one query
    const menuItems = await this.db
      .select()
      .from(schema.menuItems)
      .where(inArray(schema.menuItems.id, menuItemIds));

    if (menuItems.length !== menuItemIds.length) {
      throw new BadRequestException('One or more menu items not found');
    }

    // verify all items belong to the specified restaurant
    const allBelongToRestaurant = menuItems.every(
      (item) => item.restaurantId === dto.restaurantId,
    );

    if (!allBelongToRestaurant) {
      throw new BadRequestException(
        'All items must belong to the same restaurant',
      );
    }

    // calculate total server-side — never trust the client's price
    const total = dto.items.reduce((sum, orderItem) => {
      const menuItem = menuItems.find((m) => m.id === orderItem.menuItemId);
      if (!menuItem) return sum;
      return sum + parseFloat(menuItem.price) * parseInt(orderItem.quantity);
    }, 0);

    // insert the order
    const [order] = await this.db
      .insert(schema.orders)
      .values({
        customerId,
        restaurantId: dto.restaurantId,
        deliveryAddress: dto.deliveryAddress,
        totalAmount: total.toFixed(2),
        status: 'PENDING',
      })
      .returning();

    // insert all order items
    await this.db.insert(schema.orderItems).values(
      dto.items.map((item) => {
        const menuItem = menuItems.find((m) => m.id === item.menuItemId)!;
        return {
          orderId: order.id,
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          unitPrice: menuItem.price, // snapshot the price at time of order
        };
      }),
    );

    return order;
  };

  async findByCustomer(customerId: string, limit?: number, offset?: number) {
    return this.findOrdersWithDetails(
      eq(schema.orders.customerId, customerId),
      limit,
      offset,
    );
  };

  async findByDriver(driverId: string, limit?: number, offset?: number) {
    return this.findOrdersWithDetails(
      eq(schema.orders.driverId, driverId),
      limit,
      offset,
    );
  };

  // routes to customer or driver query based on JWT role
  async findMyOrders(userId: string, role: string, limit?: number, offset?: number) {
    if (role === UserRole.DRIVER) {
      return this.findByDriver(userId, limit, offset);
    }
    return this.findByCustomer(userId, limit, offset);
  };

  async findById(id: string, user: { sub: string; role: string }) {
    const [order] = await this.db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, id));

    if (!order) throw new NotFoundException('Order not found');

    // check access by role — each role can only view orders they're involved in
    // we use the same NotFoundException message regardless — avoids leaking whether the order exists
    const canView =
      (user.role === UserRole.CUSTOMER && order.customerId === user.sub) ||
      (user.role === UserRole.RESTAURANT_OWNER &&
        (await this.isOwnerOfRestaurant(user.sub, order.restaurantId))) ||
      (user.role === UserRole.DRIVER && order.driverId === user.sub);

    if (!canView) throw new NotFoundException('Order not found');

    const items = await this.db
      .select()
      .from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, id));

    return { ...order, items };
  };

  async findByRestaurant(ownerId: string, limit?: number, offset?: number) {
    const [restaurant] = await this.db
      .select()
      .from(schema.restaurants)
      .where(eq(schema.restaurants.ownerId, ownerId));

    if (!restaurant) throw new NotFoundException('Restaurant not found');

    return this.findOrdersWithDetails(
      eq(schema.orders.restaurantId, restaurant.id),
      limit,
      offset,
    );
  };

  async updateStatus(
    orderId: string,
    newStatus: OrderStatus,
    user: { sub: string; role: string },
  ) {
    const [order] = await this.db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId));

    if (!order) throw new NotFoundException('Order not found');

    this.validateTransition(order.status, newStatus, user.role);

    if (user.role === UserRole.RESTAURANT_OWNER) {
      const [restaurant] = await this.db
        .select()
        .from(schema.restaurants)
        .where(eq(schema.restaurants.ownerId, user.sub));

      if (!restaurant || restaurant.id !== order.restaurantId) {
        const [updated] = await this.db
          .update(schema.orders)
          .set({ status: newStatus, updatedAt: new Date() })
          .where(
            and(
              eq(schema.orders.id, orderId),
              eq(schema.orders.status, order.status),
            ),
          )
          .returning();

        if (!updated) {
          throw new ConflictException('Order status changed concurrently');
        }

        this.ordersGateway.emitOrderUpdate(updated);

        if (newStatus === 'READY') {
          try {
            await this.driverService.assignDriver(orderId);
            const ownerTransitions: Record<string, string[]> = {
              PENDING: ['CONFIRMED', 'CANCELLED'],
              CONFIRMED: ['PREPARING', 'CANCELLED'],
              PREPARING: ['READY', 'CANCELLED'],
            };

            const driverTransitions: Record<string, string[]> = {
              READY: ['PICKED_UP'],
              PICKED_UP: ['DELIVERED'],
            };

            const allowed =
              role === UserRole.RESTAURANT_OWNER
                ? (ownerTransitions[currentStatus] ?? [])
                : role === UserRole.DRIVER
                  ? (driverTransitions[currentStatus] ?? [])
                  : [];
  private validateTransition(
                    currentStatus: string,
                    newStatus: string,
                    role: string,
                  ) {
    const ownerTransitions: Record<string, string[]> = {
      CONFIRMED: ['PREPARING', 'CANCELLED'],
      PREPARING: ['READY', 'CANCELLED'],
    };

    const driverTransitions: Record<string, string[]> = {
      READY: ['PICKED_UP'],
      PICKED_UP: ['DELIVERED'],
    };

    const allowed =
      role === UserRole.RESTAURANT_OWNER
        ? (ownerTransitions[currentStatus] ?? [])
        : role === UserRole.DRIVER
          ? (driverTransitions[currentStatus] ?? [])
          : [];

    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${currentStatus} to ${newStatus}`,
      );
    };
  };

  private async isOwnerOfRestaurant(ownerId: string, restaurantId: string) {
    // one restaurant per owner — single query is enough
    const [restaurant] = await this.db
      .select()
      .from(schema.restaurants)
      .where(eq(schema.restaurants.ownerId, ownerId));

    return restaurant?.id === restaurantId;
  }

  private async enrichOrders(orderRows: (typeof schema.orders.$inferSelect)[]) {
    if (orderRows.length === 0) return [];

    const orderIds = orderRows.map((o) => o.id);
    const restaurantIds = [...new Set(orderRows.map((o) => o.restaurantId))];

    const restaurants = await this.db
      .select({
        id: schema.restaurants.id,
        name: schema.restaurants.name,
      })
      .from(schema.restaurants)
      .where(inArray(schema.restaurants.id, restaurantIds));

    const items = await this.db
      .select()
      .from(schema.orderItems)
      .where(inArray(schema.orderItems.orderId, orderIds));

    const restaurantMap = Object.fromEntries(restaurants.map((r) => [r.id, r]));

    const itemsByOrderId = new Map<string, typeof items>();
    for (const item of items) {
      const bucket = itemsByOrderId.get(item.orderId) ?? [];
      bucket.push(item);
      itemsByOrderId.set(item.orderId, bucket);
    }

    return orderRows.map((order) => ({
      ...order,
      restaurant: restaurantMap[order.restaurantId],
      items: itemsByOrderId.get(order.id) ?? [],
    }));
  };

  // shared fetch: filter orders, sort newest first, enrich with relations
  private async findOrdersWithDetails(where: SQL, limit?: number, offset?: number) {
    const baseQuery = this.db
      .select()
      .from(schema.orders)
      .where(where)
      .orderBy(desc(schema.orders.createdAt));

    const orderRows =
      typeof limit === 'number' && typeof offset === 'number'
        ? await baseQuery.limit(limit).offset(offset)
        : typeof limit === 'number'
          ? await baseQuery.limit(limit)
          : typeof offset === 'number'
            ? await baseQuery.offset(offset)
            : await baseQuery;

    return this.enrichOrders(orderRows);
  };
};