import {
  HttpTransportType,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
  type HubConnection,
} from '@microsoft/signalr';
import { getKioskConfig } from './config';

/**
 * Capa de tiempo real del kiosko (M0.4.3; desde M3.4.3 sobre el hub de SignalR).
 *
 * Es el UNICO archivo que conoce el motor; al pasar de Socket.IO al hub no
 * cambio ninguna pantalla. Misma interfaz que la webapp y la app, mas
 * `disconnect`: en el kiosko cada pantalla abre y cierra su conexion. Nombres
 * de eventos y forma de los datos: `APP EVENTOS/docs/contratos/eventos-socket.json`.
 *
 * `connect` se dispara al conectar y en cada reconexion: las salas no
 * sobreviven un reconnect (la conexion es otra), asi que el join va adentro de
 * `connect`. `disconnect` al perderla. Lo mandado sin conexion sale al conectar.
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

/** La ruta del hub en la Api de C# (`HubDeTiempoReal.Ruta`). */
const RUTA_DEL_HUB = '/tiempo-real';
const CICLO = new Set(['connect', 'disconnect']);

/** Reintentos sin fin: 2 s (el `reconnectionDelay` de antes) que se duplica hasta 5 s. */
function espera(intento: number): number {
  return Math.min(2000 * 2 ** intento, 5000);
}

class ConexionDelHub implements Realtime {
  private readonly ciclo = new Map<string, Set<Oyente>>();
  // SignalR toma lo que devuelve un oyente como respuesta al servidor: cada uno va envuelto.
  private readonly envueltos = new Map<string, Map<Oyente, Oyente>>();
  private pendientes: [string, unknown][] = [];
  private reintento: ReturnType<typeof setTimeout> | null = null;
  private intentos = 0;
  private cerrada = false;

  private readonly hub: HubConnection;

  constructor(hub: HubConnection) {
    this.hub = hub;
    hub.onreconnected(() => this.alConectar());
    hub.onreconnecting(() => this.disparar('disconnect'));
    hub.onclose(() => {
      this.disparar('disconnect');
      this.programar();
    });
    void this.arrancar();
  }

  get connected(): boolean {
    return this.hub.state === HubConnectionState.Connected;
  }

  on(event: string, fn: Oyente): this {
    if (CICLO.has(event)) {
      if (!this.ciclo.has(event)) this.ciclo.set(event, new Set());
      this.ciclo.get(event)!.add(fn);
      return this;
    }
    if (!this.envueltos.has(event)) this.envueltos.set(event, new Map());
    const delEvento = this.envueltos.get(event)!;
    if (!delEvento.has(fn)) {
      const envuelto: Oyente = (...args: unknown[]) => {
        fn(...args);
      };
      delEvento.set(fn, envuelto);
      this.hub.on(event, envuelto);
    }
    return this;
  }

  off(event: string, fn: Oyente): this {
    if (CICLO.has(event)) {
      this.ciclo.get(event)?.delete(fn);
      return this;
    }
    const envuelto = this.envueltos.get(event)?.get(fn);
    if (envuelto) {
      this.hub.off(event, envuelto);
      this.envueltos.get(event)!.delete(fn);
    }
    return this;
  }

  once(event: string, fn: Oyente): this {
    const una: Oyente = (...args: unknown[]) => {
      this.off(event, una);
      fn(...args);
    };
    return this.on(event, una);
  }

  emit(event: string, payload?: unknown): this {
    if (this.connected) this.enviar(event, payload);
    else this.pendientes.push([event, payload]);
    return this;
  }

  connect(): this {
    this.cerrada = false;
    if (this.hub.state === HubConnectionState.Disconnected) void this.arrancar();
    return this;
  }

  disconnect(): this {
    this.cerrada = true;
    if (this.reintento) clearTimeout(this.reintento);
    this.reintento = null;
    this.pendientes = [];
    void this.hub.stop().catch(() => undefined);
    return this;
  }

  private enviar(event: string, payload: unknown): void {
    const envio = payload === undefined ? this.hub.send(event) : this.hub.send(event, payload);
    envio.catch(() => undefined);
  }

  private async arrancar(): Promise<void> {
    if (this.reintento) {
      clearTimeout(this.reintento);
      this.reintento = null;
    }
    try {
      await this.hub.start();
      this.intentos = 0;
      this.alConectar();
    } catch {
      // Sin hub (apagado, red, token rechazado): se reintenta en silencio.
      this.programar();
    }
  }

  private programar(): void {
    if (this.cerrada || this.reintento) return;
    this.reintento = setTimeout(() => {
      this.reintento = null;
      if (!this.cerrada && this.hub.state === HubConnectionState.Disconnected) void this.arrancar();
    }, espera(this.intentos++));
  }

  private alConectar(): void {
    const pendientes = this.pendientes;
    this.pendientes = [];
    for (const [e, p] of pendientes) this.enviar(e, p);
    this.disparar('connect');
  }

  private disparar(event: string): void {
    for (const fn of [...(this.ciclo.get(event) ?? [])]) fn();
  }
}

export function abrirRealtime(): Realtime {
  const { socketUrl, token } = getKioskConfig();
  const hub = new HubConnectionBuilder()
    .withUrl(`${socketUrl.replace(/\/+$/, '')}${RUTA_DEL_HUB}`, {
      // Solo WebSocket y sin negociacion: sin afinidad en el balanceador.
      transport: HttpTransportType.WebSockets,
      skipNegotiation: true,
      accessTokenFactory: () => token,
    })
    .withAutomaticReconnect({ nextRetryDelayInMilliseconds: (r) => espera(r.previousRetryCount) })
    .withServerTimeout(30_000)
    .configureLogging(LogLevel.None)
    .build();
  return new ConexionDelHub(hub);
}

export function joinEvent(rt: Realtime, eventId: number): void {
  rt.emit('join:event', { eventId });
}
