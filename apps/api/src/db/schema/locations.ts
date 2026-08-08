import { orders } from './orders';
import { users } from './users';
import { foreignKey, numeric, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';


export const driverLocations = pgTable('driver_locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  driverId: uuid('driver_id').notNull()
    .references(() => users.id),
  orderId: uuid('order_id').notNull()
    .references(() => orders.id),
  latitude: numeric('latitude', { precision: 10, scale: 7 }).notNull(),
  longitude: numeric('longitude', { precision: 10, scale: 7 }).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
},
  (table) => [
    foreignKey({
      columns: [table.orderId, table.driverId],
      foreignColumns: [orders.id, orders.driverId],
      name: "driver_locations_order_driver_fk",
    }),
  ],
);

export type DriverLocation = typeof driverLocations.$inferSelect;
export type NewDriverLocation = typeof driverLocations.$inferInsert;