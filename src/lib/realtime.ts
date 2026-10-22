import { io } from 'socket.io-client';
import { getKioskConfig } from './config';

/**
 * Capa de tiempo real del kiosko (M0.4.3 de la migracion a .NET).
 *
 * Es el UNICO archivo que conoce el motor (hoy Socket.IO); cuando el hub pase
 * a SignalR (fase 3) se cambia aqui adentro y nada mas. Misma interfaz que la
 * webapp y la app, mas `disconnect`: en el kiosko cada pantalla abre y cierra
 * su conexion. Nombres de eventos y forma de los datos:
 * `APP EVENTOS/docs/contratos/eventos-socket.json`.
 *
 * `connect` se dispara al conectar y en cada reconexion: las salas no
 * sobreviven un reconnect, asi que el join va adentro de `connect`.
 */

// Manejador con datos tipados: `(payload: X) => void` entra sin cast (forma de
// metodo = comparacion bivariante, como los EventHandler de React).
type Oyente = { manejar(...args: unknown[]): void }['manejar'];

export interface Realtime {
  readonly connected: boolean;
  on(event: string, fn: Oyente): unknown;
  off(event: string, fn: Oyente): unknown;
  once(event: string, fn: Oyente): unknown;
  emit(event: string, payload?: unknown): unknown;
  connect(): unknown;
  disconnect(): unknown;
}

export function abrirRealtime(): Realtime {
  const { socketUrl, token } = getKioskConfig();
  return io(socketUrl, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 2000,
  });
}

export function joinEvent(rt: Realtime, eventId: number): void {
  rt.emit('join:event', { eventId });
}
