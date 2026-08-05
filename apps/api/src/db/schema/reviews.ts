import { orders } from './orders';
import { foreignKey, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';



export const reviews = pgTable('reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id').notNull(),
  restaurantId: uuid('restaurant_id').notNull(),
  orderId: uuid('order_id').notNull().unique()
    .references(() => orders.id, { onDelete: 'cascade' }),
  driverId: uuid('driver_id'),
  restaurantRating: integer('restaurant_rating').notNull(),
  driverRating: integer('driver_rating'),
  comment: text('comment'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
},
  (table) => [
    foreignKey({
      columns: [table.orderId],
      foreignColumns: [orders.id],
    }).onDelete("cascade"),

    foreignKey({
      columns: [table.orderId, table.customerId],
      foreignColumns: [orders.id, orders.customerId],
    }),

    foreignKey({
      columns: [table.orderId, table.restaurantId],
      foreignColumns: [orders.id, orders.restaurantId],
    }),

    foreignKey({
      columns: [table.orderId, table.driverId],
      foreignColumns: [orders.id, orders.driverId],
    }),
  ]);

export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
