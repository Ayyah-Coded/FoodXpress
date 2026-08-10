import {
  ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect,
  SubscribeMessage, WebSocketGateway, WebSocketServer,
  WsException
} from '@nestjs/websockets';
import { LocationService } from '../location/location.service';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload, UserRole } from '@food-xpress/types';
import { Inject, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq } from 'drizzle-orm';
import * as schema from '../db/schema';


export interface DriverLocation {
  driverId: string;
  orderId: string;
  latitude: number;
  longitude: number;
};

interface AuthenticatedSocket extends Socket {
  data: {
    user: JwtPayload;
  };
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/orders',
})

export class OrdersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private locationService: LocationService,
    private jwtService: JwtService,
    @Inject('DB') private db: NodePgDatabase<typeof schema>,
  ) {}

  @WebSocketServer()
  server!: Server;

  afterInit() {
    this.server.use((socket: Socket, next) => {
      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        (socket.handshake.query?.token as string | undefined);

      if (!token) {
        return next(new UnauthorizedException('No token provided'));
      }

      try {
        const payload = this.jwtService.verify<JwtPayload>(token);
        (socket as AuthenticatedSocket).data.user = payload;
        next();
      } catch {
        next(new UnauthorizedException('Invalid or expired token'));
      }
    });
  }

  handleConnection(client: Socket) {
    const user = (client as AuthenticatedSocket).data.user;
    console.log(`Client connected: ${client.id} (user: ${user.sub})`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join:order')
  async handleJoinOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() orderId: string,
  ) {
    const user = (client as AuthenticatedSocket).data.user;

    const [order] = await this.db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId));

    if (!order) {
      throw new ForbiddenException('Order not found');
    }

    const canJoin =
      (user.role === UserRole.CUSTOMER && order.customerId === user.sub) ||
      (user.role === UserRole.RESTAURANT_OWNER &&
        (await this.isOwnerOfRestaurant(user.sub, order.restaurantId))) ||
      (user.role === UserRole.DRIVER && order.driverId === user.sub);

    if (!canJoin) {
      throw new ForbiddenException('You do not have access to this order');
    }

    client.join(`order:${orderId}`);
    console.log(`Client ${client.id} joined order:${orderId}`);

    // Send the persisted driver location (if any) so a reconnecting
    // customer immediately sees the current position without waiting
    // for the next driver update.
    const persisted = await this.locationService.getDriverLocation(orderId);

    if (persisted) {
      client.emit('driver:location', {
        driverId: user.sub,
        orderId,
        latitude: Number(persisted.latitude),
        longitude: Number(persisted.longitude),
      });
    }
  }

  @SubscribeMessage('join:restaurant')
  async handleJoinRestaurant(
    @ConnectedSocket() client: Socket,
    @MessageBody() restaurantId: string,
  ) {
    const user = (client as AuthenticatedSocket).data.user;

    const isOwner = await this.isOwnerOfRestaurant(user.sub, restaurantId);

    if (!isOwner) {
      throw new ForbiddenException('You do not own this restaurant');
    }

    client.join(`restaurant:${restaurantId}`);
    console.log(`Client ${client.id} joined restaurant:${restaurantId}`);
  }

  @SubscribeMessage('join:driver')
  handleJoinDriver(
    @ConnectedSocket() client: Socket,
    @MessageBody() driverId: string,
  ) {
    const user = (client as AuthenticatedSocket).data.user;

    if (user.sub !== driverId) {
      throw new WsException('You can only join your own driver room');
    }

    client.join(`driver:${driverId}`);
    console.log(`Client ${client.id} joined driver:${driverId}`);
  }

  emitDriverAssigned(driverId: string, order: Record<string, unknown>) {
    this.server.to(`driver:${driverId}`).emit('driver:assigned', order);
  }

  @SubscribeMessage('driver:location')
  async handleDriverLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() location: Omit<DriverLocation, 'driverId'>,
  ) {
    const user = (client as AuthenticatedSocket).data.user;

    if (user.role !== UserRole.DRIVER) {
      throw new ForbiddenException('Only drivers can report location');
    }

    const driverId = user.sub;

    const [order] = await this.db
      .select()
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.id, location.orderId),
          eq(schema.orders.driverId, driverId),
        ),
      );

    if (!order) {
      throw new ForbiddenException('You are not assigned to this order');
    }

    const { latitude, longitude } = location;
    if (
      typeof latitude !== 'number' || typeof longitude !== 'number' ||
      !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 ||
      longitude < -180 || longitude > 180
    ) {
      throw new ForbiddenException('Invalid coordinates');
    }

    // persist so late-joining customers see current position
    await this.locationService.saveDriverLocation(
      location.orderId,
      location.latitude,
      location.longitude
    );

    // forward to everyone in order:<orderId> room (customer tracking screen)
    this.server
      .to(`order:${location.orderId}`)
      .emit('driver:location', { ...location, driverId });
  }

  emitOrderUpdate(order: {
    id: string;
    restaurantId: string;
    status: string;
    [key: string]: unknown;
  }) {
    // → customer watching this order
    this.server.to(`order:${order.id}`).emit('order:updated', order);
    // → owner dashboard for this restaurant
    this.server.to(`restaurant:${order.restaurantId}`).emit('order:updated', order);
  }

  private async isOwnerOfRestaurant(ownerId: string, restaurantId: string) {
    const [restaurant] = await this.db
      .select()
      .from(schema.restaurants)
      .where(
        and(
          eq(schema.restaurants.ownerId, ownerId),
          eq(schema.restaurants.id, restaurantId),
        ),
      );

    return !!restaurant;
  }
};