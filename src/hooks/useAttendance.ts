import { useEffect, useState } from 'react';
import { abrirRealtime, joinEvent, type Realtime } from '../lib/realtime';

export interface AttendanceState {
  checkedIn: number;
  total: number;
}

let socket: Realtime | null = null;

export function useAttendance(eventId: number): AttendanceState {
  const [state, setState] = useState<AttendanceState>({ checkedIn: 0, total: 0 });

  useEffect(() => {
    if (!eventId) return;

    socket = abrirRealtime();

    // Join dentro de `connect` — se re-dispara en cada reconexion (los rooms
    // no sobreviven un reconnect de Socket.IO). El server destructura `eventId`
    // (eventos-socket/src/index.ts join:event) y emite `checkedIn` camelCase.
    socket.on('connect', () => {
      if (socket) joinEvent(socket, eventId);
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
