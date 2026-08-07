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

export const useCartStore = create<CartStore>((set: (arg0: { items: any; restaurantId?: any; restaurantName?: any; }) => void, get: () => { (): any; new(): any; items: any; restaurantId?: any; }) => ({
  items: [],
  restaurantId: null,
  restaurantName: null,

  addItem: (newItem: { restaurantId: any; id: any; restaurantName: any; }) => {
    const { items, restaurantId } = get();

    // if cart already has items from this same restaurant — just add/increment
    if (restaurantId === newItem.restaurantId) {
      const existing = items.find((i: { id: any; }) => i.id === newItem.id);
      if (existing) {
        set({
          items: items.map((i: { id: any; quantity: number; }) =>
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

  removeItem: (id: any) => {
    const items = get().items.filter((item: { id: any }) => item.id !== id);
    set(
      items.length
        ? { items }
        : { items, restaurantId: null, restaurantName: null },
    );
  },

  incrementItem: (id: any) =>
    set({
      items: get().items.map((i: { id: any; quantity: number; }) =>
        i.id === id ? { ...i, quantity: i.quantity + 1 } : i,
      ),
    }),

  decrementItem: (id: any) => {
    const items = get().items;
    const item = items.find((i: { id: any; }) => i.id === id);
    if (!item) return;

    if (item.quantity === 1) {
      // remove item when quantity reaches 0
      const remainingItems = items.filter((i: { id: any; }) => i.id !== id);
      set(
        remainingItems.length
          ? { items: remainingItems }
          : { items: remainingItems, restaurantId: null, restaurantName: null },
      );
    } else {
      set({
        items: items.map((i: { id: any; quantity: number; }) =>
          i.id === id ? { ...i, quantity: i.quantity - 1 } : i,
        ),
      });
    }
  },

  clearCart: () => set({ items: [], restaurantId: null, restaurantName: null }),

  totalItems: () => get().items.reduce((sum: any, i: { quantity: any; }) => sum + i.quantity, 0),

  totalPrice: () =>
    get().items.reduce((sum: number, i: { price: string; quantity: number; }) => sum + parseFloat(i.price) * i.quantity, 0),
}));