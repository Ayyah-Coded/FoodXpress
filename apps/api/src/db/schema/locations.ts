import { orders } from './orders';
import { users } from './users';
import { foreignKey, numeric, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';


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
    unique('driver_locations_order_unique').on(table.orderId),
    foreignKey({
      columns: [table.orderId],
      foreignColumns: [orders.id],
      name: 'driver_locations_order_fk',
    }),
  ],
);

export type DriverLocation = typeof driverLocations.$inferSelect;
export type NewDriverLocation = typeof driverLocations.$inferInsert;