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

    socket.emit('join:event', { event_id: eventId });

    socket.on('checkin:update', (payload: { checked_in: number; total: number }) => {
      setState({ checkedIn: payload.checked_in, total: payload.total });
    });

    return () => {
      socket?.disconnect();
      socket = null;
    };
  }, [eventId]);

  return state;
}
