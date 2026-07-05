import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getKioskConfig } from '../lib/config';

export interface AttendanceState {
  checkedIn: number;
  total: number;
}

let socket: Socket | null = null;

export function useAttendance(eventId: number): AttendanceState {
  const [state, setState] = useState<AttendanceState>({ checkedIn: 0, total: 0 });

  useEffect(() => {
    if (!eventId) return;

    const { socketUrl, token } = getKioskConfig();

    socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 2000,
    });

    // Join dentro de `connect` — se re-dispara en cada reconexion (los rooms
    // no sobreviven un reconnect de Socket.IO). El server destructura `eventId`
    // (eventos-socket/src/index.ts join:event) y emite `checkedIn` camelCase.
    socket.on('connect', () => {
      socket?.emit('join:event', { eventId });
    });

    socket.on('checkin:update', (payload: { checkedIn: number; total: number }) => {
      setState({ checkedIn: payload.checkedIn, total: payload.total });
    });

    return () => {
      socket?.disconnect();
      socket = null;
    };
  }, [eventId]);

  return state;
}
