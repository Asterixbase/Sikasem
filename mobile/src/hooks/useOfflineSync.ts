/**
 * useOfflineSync — auto-flush the offline queue on app foreground.
 *
 * Uses React Native's built-in AppState (no extra package needed).
 * Called once at the root layout so it runs for the entire session.
 *
 * Returns { pendingCount, totalSynced, isSyncing } for the sync banner.
 */
import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useOfflineQueue } from '@/store/offlineQueue';

export function useOfflineSync() {
  const { ops, totalSynced, isSyncing, flush } = useOfflineQueue();
  const pendingCount = ops.length;

  const tryFlush = useCallback(async () => {
    if (ops.length > 0 && !isSyncing) {
      await flush();
    }
  }, [ops.length, isSyncing, flush]);

  // Ref so the AppState listener always sees the latest tryFlush
  const tryFlushRef = useRef(tryFlush);
  useEffect(() => { tryFlushRef.current = tryFlush; }, [tryFlush]);

  useEffect(() => {
    // Attempt flush immediately on mount (catches ops queued last session)
    tryFlushRef.current();

    // Re-attempt every time the app returns to foreground
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') tryFlushRef.current();
    });

    return () => sub.remove();
  }, []);

  return { pendingCount, totalSynced, isSyncing };
}
