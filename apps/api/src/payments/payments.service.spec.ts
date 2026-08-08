import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { OrdersGateway } from '../gateway/orders.gateway';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let db: any;
  let stripe: any;

  beforeEach(async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';

    const order = {
      id: 'order-1',
      customerId: 'customer-1',
      status: 'PENDING',
      totalAmount: '10.00',
      stripePaymentIntentId: 'attempt-1',
      stripePaymentAttemptId: 'attempt-1',
    };

    const tx = {
      execute: jest.fn().mockResolvedValue({ rows: [{ 1: 1 }] }),
      select: jest.fn().mockImplementation(() => ({
        from: jest.fn().mockImplementation(() => ({
          where: jest.fn().mockResolvedValue([order]),
        })),
      })),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: 'DB',
          useValue: {
            transaction: jest.fn(async (callback) => callback(tx)),
            select: jest.fn().mockImplementation(() => ({
              from: jest.fn().mockImplementation(() => ({
                where: jest.fn().mockResolvedValue([order]),
              })),
            })),
            update: jest.fn().mockImplementation(() => ({
              set: jest.fn().mockImplementation(() => ({
                where: jest.fn().mockImplementation(() => ({
                  returning: jest.fn().mockResolvedValue([order]),
                })),
              })),
            })),
          },
        },
        {
          provide: OrdersGateway,
          useValue: { emitOrderUpdate: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    db = module.get('DB');
    stripe = (service as any).stripe;
  });

  it('creates a new Stripe PaymentIntent when a previous attempt was canceled', async () => {
    const order = {
      id: 'order-1',
      customerId: 'customer-1',
      status: 'PENDING',
      totalAmount: '10.00',
      stripePaymentIntentId: 'attempt-1',
      stripePaymentAttemptId: 'attempt-1',
    };
    const canceledIntent = { id: 'attempt-1', status: 'canceled', client_secret: null };
    const replacementIntent = { id: 'attempt-2', status: 'requires_payment_method', client_secret: 'secret-2' };

    db.select
      .mockReturnValueOnce({ from: jest.fn().mockReturnValueOnce({ where: jest.fn().mockResolvedValueOnce([order]) }) })
      .mockReturnValueOnce({ from: jest.fn().mockReturnValueOnce({ where: jest.fn().mockResolvedValueOnce([order]) }) });

    stripe.paymentIntents = {
      retrieve: jest.fn().mockResolvedValue(canceledIntent),
      create: jest.fn().mockResolvedValue(replacementIntent),
    };

    const result = await service.createPaymentIntent('order-1', 'customer-1');

    expect(result.clientSecret).toBe('secret-2');
    expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1000, currency: 'usd' }),
      expect.objectContaining({ idempotencyKey: expect.any(String) }),
    );
  });

  it('writes the status update and outbox event in the same transaction on payment confirmation', async () => {
    const order = {
      id: 'order-1',
      customerId: 'customer-1',
      status: 'PENDING',
      totalAmount: '10.00',
      stripePaymentIntentId: 'pi_123',
      stripePaymentAttemptId: 'attempt-1',
    };

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

    db.transaction = jest.fn(async (callback) => callback(tx));
    db.select = jest.fn().mockImplementation(() => ({
      from: jest.fn().mockImplementation(() => ({
        where: jest.fn().mockResolvedValue([order]),
      })),
    }));

    const webhook = {
      type: 'payment_intent.succeeded',
      data: {
        object: { id: 'pi_123' },
      },
    };

    (service as any).stripe.webhooks = {
      constructEvent: jest.fn().mockReturnValue(webhook),
    };

    await service.handleWebhook(Buffer.from('payload'), 'signature');

    expect(tx.update).toHaveBeenCalled();
    expect(tx.insert).toHaveBeenCalled();
  });
});
