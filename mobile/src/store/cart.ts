/**
 * Cart store — holds POS sale items in memory during a sale session.
 * Cleared after sale confirmed or navigating away.
 */
import { create } from 'zustand';

export interface CartItem {
  product_id: string;
  name: string;
  emoji: string;
  unit_price_pesawas: number;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  paymentMethod: 'cash' | 'momo' | 'credit';

  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (product_id: string) => void;
  setQty: (product_id: string, qty: number) => void;
  setPaymentMethod: (method: CartState['paymentMethod']) => void;
  clear: () => void;
  totalPesawas: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  paymentMethod: 'cash',

  addItem: (item) => {
    const existing = get().items.find(i => i.product_id === item.product_id);
    if (existing) {
      set(state => ({
        items: state.items.map(i =>
          i.product_id === item.product_id ? { ...i, quantity: i.quantity + 1 } : i
        ),
      }));
    } else {
      set(state => ({ items: [...state.items, { ...item, quantity: 1 }] }));
    }
  },

  removeItem: (product_id) =>
    set(state => ({ items: state.items.filter(i => i.product_id !== product_id) })),

  setQty: (product_id, qty) => {
    if (qty <= 0) {
      get().removeItem(product_id);
      return;
    }
    set(state => ({
      items: state.items.map(i => i.product_id === product_id ? { ...i, quantity: qty } : i),
    }));
  },

  setPaymentMethod: (method) => set({ paymentMethod: method }),

  clear: () => set({ items: [], paymentMethod: 'cash' }),

  totalPesawas: () =>
    get().items.reduce((sum, i) => sum + i.unit_price_pesawas * i.quantity, 0),
}));
