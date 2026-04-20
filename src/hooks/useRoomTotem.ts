import { useEffect, useRef, useState, useCallback } from 'react';
import { pingTotem, processRoomScan, processRoomScanBatch, type RoomScanResult, type PingResult } from '../lib/room-api';
import * as offlineQueue from '../lib/offline-queue';

export interface RoomTotemState {
  online: boolean;
  activeSession: PingResult['session'];
  queueCount: number;
}

/**
 * Hook that manages room totem lifecycle:
 * - Heartbeat ping every 10s
 * - Offline queue sync on reconnection
 * - Tracks connectivity and active session
 */
export function useRoomTotem(totemToken: string) {
  const [state, setState] = useState<RoomTotemState>({
    online: true,
    activeSession: null,
    queueCount: 0,
  });

  const onlineRef = useRef(true);
  const syncingRef = useRef(false);

  // Ping every 10 seconds
  useEffect(() => {
    if (!totemToken) return;

    async function doPing() {
      const result = await pingTotem(totemToken);
      const wasOffline = !onlineRef.current;
      onlineRef.current = result.ok;

      setState(prev => ({
        ...prev,
        online: result.ok,
        activeSession: result.session ?? prev.activeSession,
      }));

      // Reconnected — flush offline queue
      if (result.ok && wasOffline) {
        flushQueue();
      }
    }

    doPing();
    const interval = setInterval(doPing, 10_000);
    return () => clearInterval(interval);
  }, [totemToken]);

  // Update queue count periodically
  useEffect(() => {
    async function updateCount() {
      const c = await offlineQueue.count();
      setState(prev => ({ ...prev, queueCount: c }));
    }
    updateCount();
    const interval = setInterval(updateCount, 5_000);
    return () => clearInterval(interval);
  }, []);

  const flushQueue = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;

    try {
      const scans = await offlineQueue.getAll();
      if (scans.length === 0) return;

      const batch = scans.map(s => ({
        qr_token: s.qr_token,
        device_timestamp: s.device_timestamp,
      }));

      const result = await processRoomScanBatch(batch, totemToken);
      if (result.processed > 0) {
        await offlineQueue.clear();
        setState(prev => ({ ...prev, queueCount: 0 }));
      }
    } finally {
      syncingRef.current = false;
    }
  }, [totemToken]);

  /**
   * Process a scan — try server first, queue offline if fails.
   */
  const scan = useCallback(async (qrToken: string): Promise<RoomScanResult> => {
    const result = await processRoomScan(qrToken, totemToken);

    if (!result.ok && result.code === 'SIN_CONEXION') {
      // Server unreachable — queue offline
      await offlineQueue.enqueue(qrToken);
      const c = await offlineQueue.count();
      setState(prev => ({ ...prev, online: false, queueCount: c }));
      onlineRef.current = false;
      return { ok: false, code: 'OFFLINE_QUEUED' };
    }

    return result;
  }, [totemToken]);

  return { ...state, scan, flushQueue };
}
