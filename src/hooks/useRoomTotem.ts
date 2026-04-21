import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { pingTotem, processRoomScan, processRoomScanBatch, type RoomScanResult, type PingResult } from '../lib/room-api';
import * as offlineQueue from '../lib/offline-queue';
import { getKioskConfig } from '../lib/config';

interface SessionInfo {
  id: number;
  title: string;
  speaker?: string | null;
  speaker_photo?: string | null;
  speaker_role?: string | null;
  track?: string | null;
  type?: string | null;
  starts_at: string;
  ends_at: string;
  status: 'live' | 'ended' | 'upcoming';
}

export interface RoomTotemState {
  online: boolean;
  activeSession: PingResult['session'];
  schedule: SessionInfo[];
  queueCount: number;
  roomName: string;
}

/**
 * Hook that manages room totem lifecycle:
 * - Heartbeat ping every 10s (returns full schedule)
 * - Socket connection for real-time agenda updates
 * - Offline queue sync on reconnection
 */
export function useRoomTotem(totemToken: string) {
  const [state, setState] = useState<RoomTotemState>({
    online: true,
    activeSession: null,
    schedule: [],
    queueCount: 0,
    roomName: '',
  });

  const onlineRef = useRef(true);
  const syncingRef = useRef(false);
  const socketRef = useRef<Socket | null>(null);

  // Ping every 10 seconds — returns full schedule
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
        schedule: (result as any).schedule ?? prev.schedule,
        roomName: (result as any).room_name ?? prev.roomName,
      }));

      if (result.ok && wasOffline) {
        flushQueue();
      }
    }

    doPing();
    const interval = setInterval(doPing, 10_000);
    return () => clearInterval(interval);
  }, [totemToken]);

  // Socket connection for real-time updates
  useEffect(() => {
    if (!totemToken) return;

    const { socketUrl } = getKioskConfig();
    const socket = io(socketUrl, {
      auth: { token: totemToken },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    // Listen for agenda/session changes — trigger a fresh ping
    const refreshEvents = ['session:started', 'session:ended', 'session:cancelled', 'agenda:updated', 'data:invalidate'];
    refreshEvents.forEach(event => {
      socket.on(event, () => {
        // Re-ping to get updated schedule
        pingTotem(totemToken).then(result => {
          if (result.ok) {
            setState(prev => ({
              ...prev,
              online: true,
              activeSession: result.session ?? prev.activeSession,
              schedule: (result as any).schedule ?? prev.schedule,
              roomName: (result as any).room_name ?? prev.roomName,
            }));
          }
        });
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
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

  const scan = useCallback(async (qrToken: string): Promise<RoomScanResult> => {
    const result = await processRoomScan(qrToken, totemToken);

    if (!result.ok && result.code === 'SIN_CONEXION') {
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
