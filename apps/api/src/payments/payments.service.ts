import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { OrdersGateway } from '../gateway/orders.gateway';
import * as schema from '../db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import Stripe from 'stripe';


@Injectable()
export class PaymentsService {
  private stripe: InstanceType<typeof Stripe>;

  constructor(
    @Inject('DB') private db: NodePgDatabase<typeof schema>,
    private ordersGateway: OrdersGateway,
  ) {
    // initialise Stripe with the secret key
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  };

  async createPaymentIntent(orderId: string, customerId: string) {
    const [order] = await this.db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId));

    if (!order) throw new NotFoundException('Order not found');

    if (order.customerId !== customerId) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== 'PENDING') {
      throw new BadRequestException('Order is no longer pending');
    }

    return this.db.transaction(async (tx) => {
      const reservationResult = await tx.execute(sql`SELECT 1 FROM orders WHERE id = ${orderId} AND status = 'PENDING' FOR UPDATE`);
      if (!reservationResult.rows.length) {
        throw new BadRequestException('Order is no longer pending');
      }

      const [reservedOrder] = await tx
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, orderId));

      if (!reservedOrder) throw new NotFoundException('Order not found');

      const nextAttemptId = reservedOrder.stripePaymentAttemptId ?? `order-${orderId}-${randomUUID()}`;

      const [updatedOrder] = await tx
        .update(schema.orders)
        .set({ stripePaymentAttemptId: nextAttemptId })
        .where(and(
          eq(schema.orders.id, orderId),
          eq(schema.orders.status, 'PENDING'),
        ))
        .returning();

      if (!updatedOrder) {
        throw new BadRequestException('Order is no longer pending');
      }

      return { attemptId: nextAttemptId };
    }).then(async (reservation) => {
      if (!reservation) return reservation;

      const [currentOrder] = await this.db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, orderId));

      if (!currentOrder) throw new NotFoundException('Order not found');

      if (currentOrder.stripePaymentIntentId) {
        try {
          const existingIntent = await this.stripe.paymentIntents.retrieve(currentOrder.stripePaymentIntentId);
          if (existingIntent && ['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing'].includes(existingIntent.status)) {
            return { clientSecret: existingIntent.client_secret };
          }
        } catch {
          // fall through to create a fresh intent when the stored one is unavailable
        }
      }

      const paymentIntent = await this.stripe.paymentIntents.create(
        {
          amount: Math.round(parseFloat(currentOrder.totalAmount) * 100),
          currency: 'usd',
          metadata: {
            orderId: currentOrder.id,
          },
        },
        {
          idempotencyKey: reservation.attemptId,
        },
      );

      const [updatedOrder] = await this.db
        .update(schema.orders)
        .set({
          stripePaymentIntentId: paymentIntent.id,
          stripePaymentAttemptId: reservation.attemptId,
        })
        .where(and(
          eq(schema.orders.id, orderId),
          eq(schema.orders.status, 'PENDING'),
        ))
        .returning();

      if (!updatedOrder) {
        await this.stripe.paymentIntents
          .cancel(paymentIntent.id)
          .catch(() => undefined);
        throw new BadRequestException('Order is no longer pending');
      }

      return { clientSecret: paymentIntent.client_secret };
    });
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    let event: ReturnType<typeof this.stripe.webhooks.constructEvent>;

    try {
      // verify webhook signature — ensures the request is genuinely from Stripe
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    };

    if (event.type === 'payment_intent.succeeded') {
      type StripePaymentIntent = Awaited<
        ReturnType<typeof this.stripe.paymentIntents.create>
      >;
      const paymentIntent = event.data.object as StripePaymentIntent;

      const [order] = await this.db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.stripePaymentIntentId, paymentIntent.id));

      if (!order) return { received: true }; // order not found — ignore

      // idempotency check — skip if already confirmed (Stripe can resend webhooks)
      if (order.status === 'CONFIRMED') return { received: true };

      await this.db.transaction(async (tx) => {
        const [updated] = await tx
          .update(schema.orders)
          .set({ status: 'CONFIRMED', updatedAt: new Date() })
          .where(and(
            eq(schema.orders.id, order.id),
            eq(schema.orders.status, 'PENDING')
          ))
          .returning();

        if (updated) {
          await tx.insert(schema.outboxEvents).values({
            eventType: 'order.updated',
            payload: { orderId: updated.id },
          });
        }
      });
    };

    return { received: true }; // always return 200 to Stripe
  };
};