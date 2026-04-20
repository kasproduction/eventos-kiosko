/**
 * Lee parámetros de la URL del kiosco.
 *
 * Modo lobby (check-in evento):
 *   /kiosko?event_id=1&token=SANCTUM_TOKEN
 *
 * Modo room (check-in salon):
 *   /kiosko?mode=room&totem_token=XXX&room_name=Salon+A
 */
export function getKioskConfig() {
  const params = new URLSearchParams(window.location.search);
  return {
    mode: (params.get('mode') ?? 'lobby') as 'lobby' | 'room',
    eventId: Number(params.get('event_id') ?? 0),
    token: params.get('token') ?? '',
    totemToken: params.get('totem_token') ?? '',
    roomName: params.get('room_name') ?? '',
    apiUrl: import.meta.env.VITE_API_URL ?? 'http://eventos-backend.test/api/v1',
    socketUrl: import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3001',
  };
}
