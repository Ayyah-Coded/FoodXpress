import * as schema from '../db/schema';
import { and, avg, desc, eq, sql } from 'drizzle-orm';
import { CreateReviewDto } from './dto/create-review.dto';
import { PgDatabase } from 'drizzle-orm/pg-core';
import { NodePgDatabase, NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';


@Injectable()
export class ReviewsService {
  constructor(@Inject('DB') private db: NodePgDatabase<typeof schema>) {}

  async createReview(dto: CreateReviewDto, customerId: string) {
    const [order] = await this.db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, dto.orderId));

    if (!order) throw new NotFoundException('Order not found');

    if (order.customerId !== customerId) {
      throw new ForbiddenException('You can only review your own orders');
    };

    if (order.status !== 'DELIVERED') {
      throw new BadRequestException('You can only review delivered orders');
    };

    if (dto.driverRating !== undefined && !order.driverId) {
      throw new BadRequestException('You can only rate a driver for orders with a driver');
    }

    // Serialize the review insert and the restaurant rating refresh in a single
    // transaction. Locking the restaurant row up front (FOR UPDATE) makes
    // concurrent reviews for the same restaurant run one at a time — otherwise
    // each request could compute a different average and a stale request could
    // overwrite a newer restaurant rating. Everything (insert + recalc) is
    // committed atomically, so a failed rating refresh rolls back the review
    // insert instead of leaving it without a synchronized restaurant rating.
    return this.db.transaction(async (tx) => {
      const reservationResult = await tx.execute(
        sql`SELECT 1 FROM restaurants WHERE id = ${order.restaurantId} FOR UPDATE`,
      );
      if (!reservationResult.rows.length) {
        throw new NotFoundException('Restaurant not found');
      }

      // Re-check inside the locked transaction so concurrent requests for the
      // same order cannot both insert (the unique reviews.order_id constraint
      // backs this up at the database level).
      const [existing] = await tx
        .select()
        .from(schema.reviews)
        .where(eq(schema.reviews.orderId, dto.orderId));

      if (existing) {
        throw new BadRequestException('You have already reviewed this order');
      };

      const [review] = await tx
        .insert(schema.reviews)
        .values({
          orderId: dto.orderId,
          customerId,
          restaurantId: order.restaurantId,
          driverId: order.driverId ?? null,
          restaurantRating: dto.restaurantRating,
          driverRating: dto.driverRating ?? null,
          comment: dto.comment ?? null,
        })
        .returning();

      await this.syncRestaurantRating(tx, order.restaurantId);

      return review;
    });
  };

  private async syncRestaurantRating(
    tx: PgDatabase<NodePgQueryResultHKT, typeof schema>,
    restaurantId: string,
  ) {
    const { averageRating } = await this.getRestaurantAverageRatingFrom(
      tx,
      restaurantId,
    );

    await tx
      .update(schema.restaurants)
      .set({
        rating: averageRating !== null ? averageRating.toFixed(2) : '0',
        updatedAt: new Date(),
      })
      .where(eq(schema.restaurants.id, restaurantId));
  };

  async getRestaurantReviews(restaurantId: string) {
    return this.db
      .select()
      .from(schema.reviews)
      .where(eq(schema.reviews.restaurantId, restaurantId))
      .orderBy(desc(schema.reviews.createdAt));
  };

  async getRestaurantAverageRating(restaurantId: string) {
    return this.getRestaurantAverageRatingFrom(this.db, restaurantId);
  };

  private async getRestaurantAverageRatingFrom(
    db: PgDatabase<NodePgQueryResultHKT, typeof schema>,
    restaurantId: string,
  ) {
    const [result] = await db
      .select({ avg: avg(schema.reviews.restaurantRating) })
      .from(schema.reviews)
      .where(eq(schema.reviews.restaurantId, restaurantId));

    const average = result?.avg;
    return {
      restaurantId,
      averageRating: average ? parseFloat(Number(average).toFixed(1)) : null,
    };
  };

  async getDriverAverageRating(driverId: string) {
    const [result] = await this.db
      .select({ avg: avg(schema.reviews.driverRating) })
      .from(schema.reviews)
      .where(eq(schema.reviews.driverId, driverId));

    const average = result?.avg;
    return {
      driverId,
      averageRating: average ? parseFloat(Number(average).toFixed(1)) : null,
    };
  };

  async hasReviewedOrder(orderId: string, customerId: string) {
    const [review] = await this.db
      .select()
      .from(schema.reviews)
      .where(
        and(
          eq(schema.reviews.orderId, orderId),
          eq(schema.reviews.customerId, customerId),
        ),
      );

    return { reviewed: !!review };
  };
};