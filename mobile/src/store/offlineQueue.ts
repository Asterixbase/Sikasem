/**
 * Sikasem Offline Queue — Zustand + AsyncStorage
 *
 * When a sale fails due to a network error, the operation is enqueued here
 * and replayed automatically the next time the app is in the foreground and
 * the server is reachable.
 *
 * Only `sale` operations are queued today; extend `QueuedOp.type` and the
 * `flush` switch to support additional operation types.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { salesApi } from '@/api';

// ── Types ──────────────────────────────────────────────────────────────────────

export type SalePayload = {
  items: { product_id: string; quantity: number; unit_price_pesawas: number }[];
  payment_method: 'cash' | 'momo' | 'credit';
  total_pesawas: number;
};

export interface QueuedOp {
  id: string;
  type: 'sale';
  payload: SalePayload;
  queuedAt: string;   // ISO-8601
  retries: number;
}

interface OfflineQueueState {
  ops: QueuedOp[];
  totalSynced: number;   // persisted running total — shown in system logs
  isSyncing: boolean;    // transient — not persisted

  enqueue: (payload: SalePayload) => void;
  flush: () => Promise<number>;
  clearSynced: () => void;
}

// ── Store ──────────────────────────────────────────────────────────────────────

export const useOfflineQueue = create<OfflineQueueState>()(
  persist(
    (set, get) => ({
      ops: [],
      totalSynced: 0,
      isSyncing: false,

      enqueue: (payload) => {
        const op: QueuedOp = {
          id: `op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          type: 'sale',
          payload,
          queuedAt: new Date().toISOString(),
          retries: 0,
        };
        set((s) => ({ ops: [...s.ops, op] }));
      },

      flush: async () => {
        const { ops, isSyncing } = get();
        if (isSyncing || ops.length === 0) return 0;

        set({ isSyncing: true });
        let synced = 0;
        const remaining: QueuedOp[] = [];

        for (const op of ops) {
          try {
            if (op.type === 'sale') {
              await salesApi.create(op.payload);
            }
            synced++;
          } catch {
            // Keep in queue; give up after 3 retries to avoid infinite loops
            if (op.retries < 3) {
              remaining.push({ ...op, retries: op.retries + 1 });
            }
          }
        }

        set((s) => ({
          ops: remaining,
          totalSynced: s.totalSynced + synced,
          isSyncing: false,
        }));

        return synced;
      },

      clearSynced: () => set({ totalSynced: 0 }),
    }),
    {
      name: 'sikasem-offline-queue-v1',
      storage: createJSONStorage(() => AsyncStorage),
      // isSyncing is transient — never persist it
      partialize: (state) => ({
        ops: state.ops,
        totalSynced: state.totalSynced,
      }),
    },
  ),
);

// ── Helper exported to sale.tsx ───────────────────────────────────────────────

/**
 * Returns true when the error is a network/connection failure
 * (axios threw without receiving a response — i.e. device is offline).
 */
export function isNetworkError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  // axios sets response = undefined on network errors
  return 'isAxiosError' in err &&
    (err as { isAxiosError: boolean; response?: unknown }).isAxiosError === true &&
    (err as { response?: unknown }).response === undefined;
}
