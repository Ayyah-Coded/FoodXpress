import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let refCount = 0;

function getSocket(): Socket {
  if (!socket) {
    socket = io(`${process.env.EXPO_PUBLIC_SERVER_URL}/orders`, {
      transports: ['websocket'], // force real WebSocket — skip HTTP long-polling
      autoConnect: false, // we connect manually when a screen needs it
    });
  }
  return socket;
}

function retainSocket(): Socket {
  refCount += 1;
  return getSocket();
};

function releaseSocket(): void {
  refCount = Math.max(refCount - 1, 0);
  if (refCount === 0 && socket) {
    socket.disconnect();
  }
};

const orderSubscriptions: Record<string, number> = {};
const restaurantSubscriptions: Record<string, number> = {};

function retainOrderRoom(s: Socket, orderId: string) {
  const count = (orderSubscriptions[orderId] ?? 0) + 1;
  orderSubscriptions[orderId] = count;
  if (count === 1) {
    s.emit('join:order', orderId);
  }
}

function releaseOrderRoom(s: Socket, orderId: string) {
  const count = Math.max((orderSubscriptions[orderId] ?? 0) - 1, 0);
  if (count === 0) {
    delete orderSubscriptions[orderId];
    s.emit('leave:order', orderId);
  } else {
    orderSubscriptions[orderId] = count;
  }
}

function retainRestaurantRoom(s: Socket, restaurantId: string) {
  const count = (restaurantSubscriptions[restaurantId] ?? 0) + 1;
  restaurantSubscriptions[restaurantId] = count;
  if (count === 1) {
    s.emit('join:restaurant', restaurantId);
  }
}

function releaseRestaurantRoom(s: Socket, restaurantId: string) {
  const count = Math.max((restaurantSubscriptions[restaurantId] ?? 0) - 1, 0);
  if (count === 0) {
    delete restaurantSubscriptions[restaurantId];
    s.emit('leave:restaurant', restaurantId);
  } else {
    restaurantSubscriptions[restaurantId] = count;
  }
}

export function useOrderSocket(orderId: string | null) {
  const [orderUpdate, setOrderUpdate] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    setOrderUpdate(null); // reset when orderId changes
    if (!orderId) return;

    const s = retainSocket();
    if (!s.connected) s.connect();
    retainOrderRoom(s, orderId);

    const handler = (data: { id?: string }) => {
      if (data.id === orderId) setOrderUpdate(data);
    };

    const reconnectHandler = () => {
      if (orderId) s.emit('join:order', orderId);
    };

    s.on('order:updated', handler);
    s.on('connect', reconnectHandler);

    return () => {
      s.off('order:updated', handler);
      s.off('connect', reconnectHandler);
      releaseOrderRoom(s, orderId);
      releaseSocket();
    };
  }, [orderId]);

  return orderUpdate;
};

export function useRestaurantSocket(restaurantId: string | null) {
  const [updateCount, setUpdateCount] = useState(0);

  useEffect(() => {
    if (!restaurantId) return;

    const s = retainSocket();
    if (!s.connected) s.connect();
    retainRestaurantRoom(s, restaurantId);

    const handler = () => {
      setUpdateCount((count) => count + 1);
    };

    const reconnectHandler = () => {
      if (restaurantId) s.emit('join:restaurant', restaurantId);
    };

    s.on('order:updated', handler);
    s.on('connect', reconnectHandler);

    return () => {
      s.off('order:updated', handler);
      s.off('connect', reconnectHandler);
      releaseRestaurantRoom(s, restaurantId);
      releaseSocket();
    };
  }, [restaurantId]);

  return updateCount; // screen calls invalidateQueries when this changes
};

export function useDriverLocationSocket(orderId: string | null) {
  const [driverLocation, setDriverLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  useEffect(() => {
    setDriverLocation(null); // reset when orderId changes
    if (!orderId) return;

    const s = retainSocket();
    if (!s.connected) s.connect();
    retainOrderRoom(s, orderId);

    const handler = (data: { latitude: number; longitude: number }) => {
      setDriverLocation({
        latitude: data.latitude,
        longitude: data.longitude,
      });
    };

    const reconnectHandler = () => {
      if (orderId) s.emit('join:order', orderId);
    };

    s.on('driver:location', handler);
    s.on('connect', reconnectHandler);

    return () => {
      s.off('driver:location', handler);
      s.off('connect', reconnectHandler);
      releaseOrderRoom(s, orderId);
      releaseSocket();
    };
  }, [orderId]);

  return driverLocation;
};
