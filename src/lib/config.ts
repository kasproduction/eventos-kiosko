/**
 * Lee parámetros de la URL del kiosco.
 * Uso: /kiosko?event_id=1&token=SANCTUM_TOKEN
 */
export function getKioskConfig() {
  const params = new URLSearchParams(window.location.search);
  return {
    eventId: Number(params.get('event_id') ?? 0),
    token: params.get('token') ?? '',
    apiUrl: import.meta.env.VITE_API_URL ?? 'http://eventos-backend.test/api/v1',
    socketUrl: import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3001',
  };
}
