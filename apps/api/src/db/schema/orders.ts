import { users } from './users';
import { menuItems } from './menus';
import { restaurants } from './restaurants';
import { sql } from 'drizzle-orm';
import {
  check, foreignKey, integer, json, numeric, pgEnum, pgTable,
  text, timestamp, unique, uuid
} from 'drizzle-orm/pg-core';



export const orderStatusEnum = pgEnum('order_status', [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'PICKED_UP',
  'DELIVERED',
  'CANCELLED',
]);

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id').notNull()
    .references(() => users.id),
  restaurantId: uuid('restaurant_id').notNull()
    .references(() => restaurants.id),
  driverId: uuid('driver_id').references(() => users.id),
  status: orderStatusEnum('status').notNull().default('PENDING'),
  totalAmount: numeric('total_amount', { precision: 10, scale: 2 }).notNull(),
  deliveryAddress: text('delivery_address').notNull(),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
},
  (table) => [
    unique("orders_id_customer_unique").on(table.id, table.customerId),
    unique("orders_id_driver_unique").on(table.id, table.driverId),
    unique("orders_id_restaurant_unique").on(table.id, table.restaurantId),

    check(
      "orders_total_amount_non_negative",
      sql<boolean>`${table.totalAmount} >= 0`
    ),
  ],
);

export const outboxEvents = pgTable('outbox_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventType: text('event_type').notNull(),
  payload: json('payload').notNull(),
  retryCount: integer('retry_count').default(0).notNull(),
  lastError: text('last_error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  processedAt: timestamp('processed_at'),
},
  (table) => [
    check(
      "outbox_events_retry_count_non_negative",
      sql`${table.retryCount} >= 0`
    ),
  ],
);

export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull()
    .references(() => restaurants.id),
  orderId: uuid('order_id').notNull(),
  menuItemId: uuid('menu_item_id').notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
},
  (table) => [
    foreignKey({
      columns: [table.orderId, table.restaurantId],
      foreignColumns: [orders.id, orders.restaurantId],
      name: "order_items_order_restaurant_fk",
    }).onDelete("cascade"),

    foreignKey({
      columns: [table.menuItemId, table.restaurantId],
      foreignColumns: [menuItems.id, menuItems.restaurantId],
      name: "order_items_menuitem_restaurant_fk",
    }),

    check(
      "order_items_quantity_positive",
      sql`${table.quantity} > 0`
    ),

    check(
      "order_items_unit_price_non_negative",
      sql`${table.unitPrice} >= 0`
    ),
  ],
);

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type OutboxEvent = typeof outboxEvents.$inferSelect;