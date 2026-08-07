import { create } from 'zustand';
import { CartItem } from '@food-xpress/types';

interface CartStore {
  items: CartItem[];
  restaurantId: string | null; // tracks which restaurant the cart belongs to
  restaurantName: string | null;

  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (id: string) => void;
  incrementItem: (id: string) => void;
  decrementItem: (id: string) => void;
  clearCart: () => void;

  totalItems: () => number;
  totalPrice: () => number;
}

export const useCartStore = create<CartStore>(
  (set: (partial: Partial<CartStore> | ((state: CartStore) => Partial<CartStore>)) => void, get: () => CartStore) => ({
    items: [],
    restaurantId: null,
    restaurantName: null,

    addItem: (newItem: Omit<CartItem, 'quantity'>) => {
      const { items, restaurantId } = get();

      // if cart already has items from this same restaurant — just add/increment
      if (restaurantId === newItem.restaurantId) {
        const existing = items.find((i) => i.id === newItem.id);
        if (existing) {
          set({
            items: items.map((i) =>
              i.id === newItem.id ? { ...i, quantity: i.quantity + 1 } : i,
            ),
          });
        } else {
          set({ items: [...items, { ...newItem, quantity: 1 }] });
        }
        return;
      }

      // different restaurant — caller must confirm before calling this
      // cart is cleared and new item replaces it
      set({
        items: [{ ...newItem, quantity: 1 }],
        restaurantId: newItem.restaurantId,
        restaurantName: newItem.restaurantName,
      });
    },

    removeItem: (id: string) => {
      const items = get().items.filter((item) => item.id !== id);
      set(
        items.length
          ? { items }
          : { items, restaurantId: null, restaurantName: null },
      );
    },

    incrementItem: (id: string) =>
      set({
        items: get().items.map((i) =>
          i.id === id ? { ...i, quantity: i.quantity + 1 } : i,
        ),
      }),

    decrementItem: (id: string) => {
      const items = get().items;
      const item = items.find((i) => i.id === id);
      if (!item) return;

      if (item.quantity === 1) {
        // remove item when quantity reaches 0
        const remainingItems = items.filter((i) => i.id !== id);
        set(
          remainingItems.length
            ? { items: remainingItems }
            : { items: remainingItems, restaurantId: null, restaurantName: null },
        );
      } else {
        set({
          items: items.map((i) =>
            i.id === id ? { ...i, quantity: i.quantity - 1 } : i,
          ),
        });
      }
    },

    clearCart: () => set({ items: [], restaurantId: null, restaurantName: null }),

    totalItems: () => get().items.reduce((sum: number, i: CartItem) => sum + i.quantity, 0),

    totalPrice: () =>
      get().items.reduce((sum: number, i: CartItem) => sum + parseFloat(String(i.price)) * i.quantity, 0),
  }));