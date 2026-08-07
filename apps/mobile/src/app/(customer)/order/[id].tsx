import { useEffect, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';

import { api } from '@/lib/axios';
import { Order } from '@food-xpress/types';
import { useStripe } from '@stripe/stripe-react-native';
import { RatingModal } from '@/components/rating-modal';
import { useOrderSocket, useDriverLocationSocket } from '@/hooks/use-order-socket';
import {
  ActivityIndicator, Alert, Pressable, ScrollView,
  StyleSheet, Text, View, Platform
} from 'react-native';


const STATUS_STEPS = [
  { key: 'CONFIRMED', label: 'Order Confirmed', icon: '✅' },
  { key: 'PREPARING', label: 'Being Prepared', icon: '👨‍🍳' },
  { key: 'READY', label: 'Ready for Pickup', icon: '📦' },
  { key: 'PICKED_UP', label: 'Driver Picked Up', icon: '🛵' },
  { key: 'DELIVERED', label: 'Delivered', icon: '🎉' },
];

const STATUS_ORDER = [
  'CONFIRMED',
  'PREPARING',
  'READY',
  'PICKED_UP',
  'DELIVERED',
];

export default function OrderConfirmationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const orderUpdate = useOrderSocket(id ?? null);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<'pending' | 'reviewed' | 'unreviewed'>('pending');
  const [reviewSubmitError, setReviewSubmitError] = useState<string | null>(null);

  const [cachedDriverLocation, setCachedDriverLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  useEffect(() => {
    if (orderUpdate) {
      // update React Query cache directly — no new HTTP request needed
      // ['order', id] must match the queryKey in useQuery above
      queryClient.setQueryData(['order', id], (old: unknown) => ({
        ...(old as object),
        ...orderUpdate,
      }));
    }
  }, [orderUpdate, id, queryClient]);

  const {
    data: order,
    isLoading,
    isError,
    refetch,
  } = useQuery<Order & { items: any[] }>({
    queryKey: ['order', id],
    queryFn: () =>
      api.get<Order & { items: any[] }>(`/orders/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  useEffect(() => {
    if (!id || order?.status !== 'DELIVERED') return;

    api
      .get<{ reviewed: boolean }>(`/reviews/order/${id}/status`)
      .then((r) => {
        if (r.data.reviewed) {
          setRatingSubmitted(true);
          setReviewStatus('reviewed');
        } else {
          setReviewStatus('unreviewed');
        }
      })
      .catch(() => {
        setReviewStatus('pending');
      });
  }, [id, order?.status]);

  useEffect(() => {
    if (
      order?.status === 'DELIVERED' &&
      !ratingSubmitted &&
      reviewStatus === 'unreviewed'
    ) {
      const timer = setTimeout(() => setShowRatingModal(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [order?.status, ratingSubmitted, reviewStatus]);

  const { mutate: submitReview, isPending: isSubmittingReview } = useMutation({
    mutationFn: (data: {
      restaurantRating: number;
      driverRating?: number;
      comment?: string;
    }) => api.post('/reviews', { orderId: id, ...data }),
    onSuccess: () => {
      setShowRatingModal(false);
      setRatingSubmitted(true);
      setReviewSubmitError(null);
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
    },
    onError: (error: any) => {
      setReviewSubmitError(
        error?.response?.data?.message ?? 'Failed to submit your review. Please try again.',
      );
    },
  });

  const liveDriverLocation = useDriverLocationSocket(
    order?.status === 'PICKED_UP' ? (id ?? null) : null,
  );

  // hydrate from Redis when customer opens screen mid-delivery
  useEffect(() => {
    if (!id || !order?.driverId || order?.status !== 'PICKED_UP') return;

    api
      .get<{ latitude: number; longitude: number } | null>(`/location/${id}`)
      .then((r) => {
        if (r.data) setCachedDriverLocation(r.data);
      })
      .catch(() => {});
  }, [id, order?.driverId, order?.status]);

  const driverLocation = liveDriverLocation ?? cachedDriverLocation;
  const showMap = !!driverLocation && order?.status === 'PICKED_UP';

  async function handlePayment() {
    if (!order) return;
    setPaymentLoading(true);

    try {
      const res = await api.post<{ clientSecret: string }>('/payments/intent', {
        orderId: order.id,
      });

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'Food Delivery',
        paymentIntentClientSecret: res.data.clientSecret,
      });

      if (initError) {
        Alert.alert('Payment setup failed', initError.message);
        return;
      }

      const { error: paymentError } = await presentPaymentSheet();

      if (paymentError) {
        Alert.alert('Payment failed', paymentError.message);
        return;
      }

      let confirmed = false;
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const { data } = await refetch();
        if (data?.status === 'CONFIRMED') {
          confirmed = true;
          break;
        }
      }

      if (confirmed) {
        Alert.alert('Payment confirmed!', 'Your order is being prepared.');
      } else {
        Alert.alert(
          'Payment submitted',
          'Your payment is being processed. Check your order status shortly.',
        );
      }
    } catch (e: any) {
      Alert.alert(
        'Error',
        e?.response?.data?.message ?? 'Something went wrong',
      );
    } finally {
      setPaymentLoading(false);
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Failed to load order details.</Text>
          <Pressable style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const currentIndex = STATUS_ORDER.indexOf(order?.status ?? '');

  const headerEmoji =
    order?.status === 'CONFIRMED'
      ? '✅'
      : order?.status === 'PREPARING'
        ? '👨‍🍳'
        : order?.status === 'READY'
          ? '📦'
          : order?.status === 'PICKED_UP'
            ? '🛵'
            : order?.status === 'DELIVERED'
              ? '🎉'
              : order?.status === 'CANCELLED'
                ? '❌'
                : '🕒';

  const headerTitle =
    order?.status === 'CONFIRMED'
      ? 'Order Confirmed!'
      : order?.status === 'PREPARING'
        ? 'Order is Preparing'
        : order?.status === 'READY'
          ? 'Ready for Pickup'
          : order?.status === 'PICKED_UP'
            ? 'Driver Picked Up'
            : order?.status === 'DELIVERED'
              ? 'Order Delivered!'
              : order?.status === 'CANCELLED'
                ? 'Order Cancelled'
                : 'Order Placed!';

  const headerSubtitle =
    order?.status === 'CONFIRMED'
      ? 'Your payment was successful'
      : order?.status === 'PREPARING'
        ? 'Your meal is being prepared'
        : order?.status === 'READY'
          ? 'Your order is ready to be picked up'
          : order?.status === 'PICKED_UP'
            ? 'Your driver is on the way'
            : order?.status === 'DELIVERED'
              ? 'Enjoy your meal!'
              : order?.status === 'CANCELLED'
                ? 'This order has been cancelled.'
                : 'Complete your payment below';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.content}>
          <Text style={styles.emoji}>{headerEmoji}</Text>
          <Text style={styles.title}>{headerTitle}</Text>
          <Text style={styles.subtitle}>{headerSubtitle}</Text>

          <View style={styles.card}>
            <Text style={styles.label}>Order ID</Text>
            <Text style={styles.value}>
              {order?.id.slice(0, 8).toUpperCase()}
            </Text>

            <Text style={styles.label}>Total</Text>
            <Text style={styles.value}>${order?.totalAmount}</Text>

            <Text style={styles.label}>Delivery to</Text>
            <Text style={styles.value}>{order?.deliveryAddress}</Text>

            <Text style={styles.label}>Status</Text>
            <Text
              style={[
                styles.statusBadge,
                order?.status === 'CONFIRMED'
                  ? styles.confirmed
                  : styles.pending,
              ]}
            >
              {order?.status}
            </Text>
          </View>

          {order?.status === 'PENDING' && (
            <Pressable
              style={styles.payButton}
              onPress={() => {
                void handlePayment();
              }}
              disabled={paymentLoading}
            >
              {paymentLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.payButtonText}>
                  Pay ${order?.totalAmount}
                </Text>
              )}
            </Pressable>
          )}

          {showMap && (
            <MapView
              style={styles.map}
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
              region={{
                latitude: driverLocation.latitude,
                longitude: driverLocation.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
            >
              <Marker
                coordinate={driverLocation}
                title="Your driver"
                description="On the way to you"
              >
                <Text style={styles.driverPin}>🛵</Text>
              </Marker>
            </MapView>
          )}

          {order?.status === 'CANCELLED' ? (
            <View style={styles.cancelledBox}>
              <Text style={styles.cancelledText}>❌ Order Cancelled</Text>
            </View>
          ) : order?.status !== 'PENDING' ? (
            <View style={styles.tracker}>
              <Text style={styles.trackerTitle}>Order Progress</Text>
              {STATUS_STEPS.map((step, index) => {
                const isCompleted = index <= currentIndex;
                const isActive = index === currentIndex;
                return (
                  <View key={step.key} style={styles.step}>
                    <View style={styles.stepLeft}>
                      <View
                        style={[
                          styles.stepCircle,
                          isCompleted && styles.stepCircleCompleted,
                          isActive && styles.stepCircleActive,
                        ]}
                      >
                        <Text style={styles.stepIcon}>
                          {isCompleted ? step.icon : '○'}
                        </Text>
                      </View>
                      {index < STATUS_STEPS.length - 1 && (
                        <View
                          style={[
                            styles.stepLine,
                            isCompleted && styles.stepLineCompleted,
                          ]}
                        />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.stepLabel,
                        isActive && styles.stepLabelActive,
                        isCompleted && styles.stepLabelCompleted,
                      ]}
                    >
                      {step.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          <Pressable
            style={styles.homeButton}
            onPress={() => router.replace('/(customer)/(tabs)/(home)')}
          >
            <Text style={styles.homeButtonText}>Back to Home</Text>
          </Pressable>
        </View>

        <RatingModal
          visible={showRatingModal}
          hasDriver={!!order?.driverId}
          onSubmit={submitReview}
          onDismiss={() => {
            setShowRatingModal(false);
            setRatingSubmitted(true);
            setReviewSubmitError(null);
          }}
          isSubmitting={isSubmittingReview}
          errorMessage={reviewSubmitError}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

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
    padding: 24,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
  },
  card: {
    width: '100%',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 20,
    gap: 8,
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    color: '#999',
    marginTop: 8,
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    fontSize: 13,
    fontWeight: '700',
  },
  confirmed: {
    color: '#16A34A',
  },
  pending: {
    color: '#FF6B35',
  },
  payButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 8,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 18,
    color: '#EF4444',
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  homeButton: {
    borderRadius: 8,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  homeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  trackerTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
    color: '#333',
  },
  cancelledBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },
  cancelledText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  tracker: {
    marginBottom: 24,
    width: '100%',
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepLeft: {
    alignItems: 'center',
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleCompleted: {
    backgroundColor: '#DCFCE7',
  },
  stepCircleActive: {
    backgroundColor: '#FF6B35',
  },
  stepIcon: {
    fontSize: 16,
  },
  stepLine: {
    width: 2,
    height: 32,
    backgroundColor: '#f0f0f0',
    marginVertical: 2,
  },
  stepLineCompleted: {
    backgroundColor: '#22C55E',
  },
  stepLabel: {
    fontSize: 15,
    color: '#999',
    paddingTop: 10,
  },
  stepLabelActive: {
    color: '#FF6B35',
    fontWeight: '700',
  },
  stepLabelCompleted: {
    color: '#333',
    fontWeight: '500',
  },
  map: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    marginBottom: 24,
    overflow: 'hidden',
  },
  driverPin: {
    fontSize: 28,
  },
});