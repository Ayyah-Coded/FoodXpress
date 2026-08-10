import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/auth-context';
import { io, Socket } from 'socket.io-client';
import { Order } from '@food-xpress/types';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/axios';
import { getToken } from '@/lib/auth';


let socket: Socket | null = null;

export default function DriverHomeScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [incomingOrder, setIncomingOrder] = useState<Order | null>(null);
  const incomingOrderRef = useRef<Order | null>(null);
  const pendingOrdersRef = useRef<Order[]>([]);

  const setCurrentOrder = (order: Order | null) => {
    incomingOrderRef.current = order;
    setIncomingOrder(order);
  };

  // fetch current online/offline state from GET /driver/status
  const { data: status, isLoading } = useQuery<{ isOnline: boolean }>({
    queryKey: ['driver-status'],
    queryFn: () =>
      api.get<{ isOnline: boolean }>('/driver/status').then((r) => r.data),
  });

  // set online/offline state on the server via PATCH /driver/online
  const { mutate: setOnline, isPending: toggling } = useMutation({
    mutationFn: (isOnline: boolean) =>
      api.patch('/driver/online', { isOnline }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['driver-status'] }),
  });

  // driver declines → POST /driver/orders/:id/decline
  const { mutate: declineOrder } = useMutation({
    mutationFn: (orderId: string) =>
      api.post(`/driver/orders/${orderId}/decline`),
    onSuccess: () => {
      const next = pendingOrdersRef.current.shift();
      setCurrentOrder(next ?? null);
    },
    onError: (e: any) =>
      Alert.alert(
        'Error',
        e?.response?.data?.message ?? 'Something went wrong',
      ),
  });

  // driver accepts → PATCH /orders/:id/status { status: 'PICKED_UP' }
  const { mutate: acceptOrder } = useMutation({
    mutationFn: (orderId: string) =>
      api.patch(`/orders/${orderId}/status`, { status: 'PICKED_UP' }),
    onSuccess: () => {
      const next = pendingOrdersRef.current.shift();
      setCurrentOrder(next ?? null);
      queryClient.invalidateQueries({ queryKey: ['driver-active-orders'] });
    },
    onError: (e: any) =>
      Alert.alert(
        'Error',
        e?.response?.data?.message ?? 'Something went wrong',
      ),
  });

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    (async () => {
      const token = await getToken();

      if (cancelled || !token) return;

      socket = io(`${process.env.EXPO_PUBLIC_SERVER_URL}/orders`, {
        transports: ['websocket'],
        auth: { token },
      });

      socket.emit('join:driver', user.id);

      // server pushes this when DriverService.assignDriver() runs
      socket.on('driver:assigned', (order: Order) => {
        if (incomingOrderRef.current) {
          // a request is already on screen — queue it so it isn't lost
          pendingOrdersRef.current.push(order);
        } else {
          setCurrentOrder(order);
        }
      });
    })();

    return () => {
      cancelled = true;
      socket?.disconnect();
      socket = null;
    };
  }, [user?.id]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      </SafeAreaView>
    );
  }

  const isOnline = status?.isOnline ?? false;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.title}>Driver Dashboard</Text>

        {/* online/offline toggle card */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>
              {isOnline ? '🟢 You are Online' : '🔴 You are Offline'}
            </Text>
            <Switch
              value={isOnline}
              onValueChange={(value) => {
                setOnline(value);
              }}
              disabled={toggling}
              trackColor={{ false: '#FECACA', true: '#86EFAC' }}
              thumbColor={isOnline ? '#22C55E' : '#EF4444'}
            />
          </View>
          <Text style={styles.statusSubtext}>
            {isOnline
              ? 'You will receive delivery requests'
              : 'Go online to start receiving orders'}
          </Text>
        </View>
      </View>

      {/* incoming order modal — shown when driver:assigned fires */}
      <Modal visible={!!incomingOrder} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>🛵 New Delivery Request</Text>

            <View style={styles.orderDetails}>
              <Text style={styles.orderLabel}>Order ID</Text>
              <Text style={styles.orderValue}>
                #{incomingOrder?.id.slice(0, 8).toUpperCase()}
              </Text>

              <Text style={styles.orderLabel}>Deliver to</Text>
              <Text style={styles.orderValue}>
                {incomingOrder?.deliveryAddress}
              </Text>

              <Text style={styles.orderLabel}>Total</Text>
              <Text style={styles.orderValue}>
                ${incomingOrder?.totalAmount}
              </Text>
            </View>

            <Pressable
              style={styles.acceptButton}
              onPress={() => {
                if (incomingOrder) acceptOrder(incomingOrder.id);
              }}
            >
              <Text style={styles.acceptButtonText}>Accept</Text>
            </Pressable>

            <Pressable
              style={styles.declineButton}
              onPress={() => {
                if (incomingOrder) declineOrder(incomingOrder.id);
              }}
            >
              <Text style={styles.declineButtonText}>Decline</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
  },
  statusCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 16,
    padding: 20,
    gap: 8,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 17,
    fontWeight: '600',
  },
  statusSubtext: {
    fontSize: 13,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  orderDetails: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  orderLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  orderValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  acceptButton: {
    backgroundColor: '#22C55E',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  declineButton: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  declineButtonText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
  },
});