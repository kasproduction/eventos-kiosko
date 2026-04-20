import type { RoomTotemState } from '../../hooks/useRoomTotem';

interface Props {
  state: RoomTotemState;
  roomName: string;
  onStartScan: () => void;
}

export function RoomIdleScreen({ state, roomName, onStartScan }: Props) {
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-between bg-[#0f0f1a] text-white cursor-pointer"
      onClick={onStartScan}
    >
      {/* Top: status bar */}
      <div className="w-full flex justify-between items-center px-10 pt-8">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${state.online ? 'bg-emerald-400' : 'bg-red-500 animate-pulse'}`} />
          <span className="text-white/40 text-sm">
            {state.online ? 'Conectado' : 'Sin conexion'}
          </span>
          {state.queueCount > 0 && (
            <span className="bg-amber-500/20 text-amber-300 text-xs px-2 py-0.5 rounded-full">
              {state.queueCount} pendientes
            </span>
          )}
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2">
          <p className="text-white/60 text-sm font-medium">{roomName}</p>
        </div>
      </div>

      {/* Center: session info + CTA */}
      <div className="flex flex-col items-center gap-8">
        {state.activeSession && (
          <div className="bg-white/5 border border-white/10 rounded-2xl px-8 py-4 text-center max-w-lg">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Sesion en curso</p>
            <p className="text-white text-xl font-semibold">{state.activeSession.title}</p>
          </div>
        )}

        <div className="relative flex items-center justify-center">
          <div className="absolute w-56 h-56 rounded-full bg-indigo-500/10 animate-ping" />
          <div className="absolute w-44 h-44 rounded-full bg-indigo-500/15 animate-pulse" />
          <div className="relative w-36 h-36 rounded-3xl bg-white/5 border-2 border-white/20 flex items-center justify-center text-7xl">
            🔳
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-5xl font-bold tracking-tight">Escanea tu QR</h1>
          <p className="text-white/40 text-lg mt-3">Entrada / Salida del salon</p>
        </div>
      </div>

      {/* Bottom: branding */}
      <div className="pb-10">
        <p className="text-white/20 text-sm tracking-widest uppercase">EventOS · Salon</p>
      </div>
    </div>
  );
}
