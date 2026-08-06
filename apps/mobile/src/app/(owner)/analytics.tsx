import { useMemo } from 'react';
import { api } from '@/lib/axios';
import { useQuery } from '@tanstack/react-query';
import { Order, RestaurantType } from '@food-xpress/types';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: '#3B82F6',
  PREPARING: '#8B5CF6',
  READY: '#06B6D4',
  PICKED_UP: '#FF6B35',
  DELIVERED: '#22C55E',
  CANCELLED: '#EF4444',
};

const AGGREGATION_TIME_ZONE = 'UTC';

function getAggregationDayRange(timeZone: string) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value;
      return acc;
    }, {});

  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);

  const from = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0)).toISOString();
  const to = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999)).toISOString();

  return { from, to };
}

export default function OwnerAnalyticsScreen() {
  const { data: restaurant, isLoading: restaurantLoading } =
    useQuery<RestaurantType | null>({
      queryKey: ['my-restaurant'],
      queryFn: () => api.get<RestaurantType | null>('/restaurants/mine').then((r) => r.data),
    });

  const { from, to } = getAggregationDayRange(AGGREGATION_TIME_ZONE);

  const { data: orders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ['restaurant-orders', from, to],
    queryFn: () => api
      .get<Order[]>(`/orders/restaurant?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then((r) => r.data),
    enabled: !!restaurant,
  });

  const totalRevenue = useMemo(() => {
    return orders
      .filter((o) => o.status !== 'CANCELLED')
      .reduce((sum, o) => sum + Number(o.totalAmount), 0)
      .toFixed(2);
  }, [orders]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach((o) => {
      counts[o.status] = (counts[o.status] ?? 0) + 1;
    });
    return counts;
  }, [orders]);

  const isLoading = restaurantLoading || ordersLoading;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      </SafeAreaView>
    );
  };

  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Today's Summary</Text>
      <Text style={styles.date}>
        {new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })}
      </Text>

      <View style={styles.revenueCard}>
        <View style={styles.revenueRow}>
          <View style={styles.revenueItem}>
            <Text style={styles.revenueValue}>{orders.length}</Text>
            <Text style={styles.revenueLabel}>Orders</Text>
          </View>
          <View style={styles.revenueDivider} />
          <View style={styles.revenueItem}>
            <Text style={styles.revenueValue}>${totalRevenue}</Text>
            <Text style={styles.revenueLabel}>Revenue</Text>
          </View>
        </View>
      </View>

      {Object.keys(statusCounts).length > 0 && (
        <View style={styles.statusBreakdown}>
          {Object.entries(statusCounts).map(([status, count]) => (
            <View key={status} style={styles.statusRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: STATUS_COLORS[status] ?? '#999' },
                ]}
              />
              <Text style={styles.statusLabel}>{status}</Text>
              <Text style={styles.statusCount}>{count}</Text>
            </View>
          ))}
        </View>
      )}

      {orders.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No orders today yet</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 88 },
          ]}
          renderItem={({ item }) => (
            <View style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <Text style={styles.orderId}>
                  #{item.id.slice(0, 8).toUpperCase()}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        (STATUS_COLORS[item.status] ?? '#999') + '20',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      { color: STATUS_COLORS[item.status] ?? '#999' },
                    ]}
                  >
                    {item.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.orderItems}>
                {item.items?.length ?? 0} item{(item.items?.length ?? 0) !== 1 ? 's' : ''}
              </Text>
              <Text style={styles.orderTotal}>
                ${Number(item.totalAmount).toFixed(2)}
              </Text>
            </View>
          )}
        />)}
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
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  date: {
    fontSize: 14,
    color: '#999',
    paddingHorizontal: 24,
    marginBottom: 16,
    marginTop: 4,
  },
  revenueCard: {
    backgroundColor: '#f9f9f9',
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
  },
  revenueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  revenueItem: {
    flex: 1,
    alignItems: 'center',
  },
  revenueValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#333',
  },
  revenueLabel: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  revenueDivider: {
    width: 1,
    height: 48,
    backgroundColor: '#e5e5e5',
  },
  statusBreakdown: {
    marginHorizontal: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusLabel: {
    flex: 1,
    fontSize: 14,
    color: '#555',
  },
  statusCount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  list: {
    padding: 16,
    gap: 10,
  },
  orderCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  orderItems: {
    fontSize: 13,
    color: '#777',
  },
  orderTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});