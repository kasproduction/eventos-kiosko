import type { RoomTotemState } from '../../hooks/useRoomTotem';

interface SessionInfo {
  id: number;
  title: string;
  speaker?: string | null;
  starts_at: string;
  ends_at: string;
  status: 'live' | 'ended' | 'upcoming';
}

interface Props {
  state: RoomTotemState;
  roomName: string;
  schedule: SessionInfo[];
  onStartScan: () => void;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function RoomIdleScreen({ state, roomName, schedule, onStartScan }: Props) {
  const liveSession = schedule.find(s => s.status === 'live');
  const nextSession = schedule.find(s => s.status === 'upcoming');

  return (
    <div
      className="w-full h-full flex flex-col bg-[#0a0a14] text-white cursor-pointer select-none"
      onClick={onStartScan}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-8 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${state.online ? 'bg-emerald-400' : 'bg-red-500 animate-pulse'}`} />
          <span className="text-white/30 text-xs font-medium uppercase tracking-wider">
            {state.online ? 'En linea' : 'Offline'}
          </span>
          {state.queueCount > 0 && (
            <span className="bg-amber-500/15 text-amber-400 text-[10px] font-semibold px-2 py-0.5 rounded-full">
              {state.queueCount} en cola
            </span>
          )}
        </div>
        <div className="text-white/40 text-sm font-semibold tracking-wide uppercase">
          {roomName}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6">

        {/* Live Session Card */}
        {liveSession && (
          <div className="w-full max-w-md bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest">En vivo</span>
            </div>
            <h2 className="text-2xl font-bold text-white leading-tight">{liveSession.title}</h2>
            {liveSession.speaker && (
              <p className="text-white/50 text-sm mt-1">{liveSession.speaker}</p>
            )}
            <p className="text-emerald-300/60 text-sm mt-2 font-mono">
              {formatTime(liveSession.starts_at)} — {formatTime(liveSession.ends_at)}
            </p>
          </div>
        )}

        {/* No live session — show next */}
        {!liveSession && nextSession && (
          <div className="w-full max-w-md bg-white/[0.03] border border-white/10 rounded-2xl p-6">
            <span className="text-white/30 text-xs font-bold uppercase tracking-widest">Siguiente</span>
            <h2 className="text-xl font-bold text-white mt-2">{nextSession.title}</h2>
            {nextSession.speaker && (
              <p className="text-white/40 text-sm mt-1">{nextSession.speaker}</p>
            )}
            <p className="text-white/30 text-sm mt-2 font-mono">
              {formatTime(nextSession.starts_at)} — {formatTime(nextSession.ends_at)}
            </p>
          </div>
        )}

        {/* Scan CTA */}
        <div className="flex flex-col items-center gap-5 mt-4">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-40 h-40 rounded-full bg-indigo-500/8 animate-ping" style={{ animationDuration: '3s' }} />
            <div className="absolute w-32 h-32 rounded-full bg-indigo-500/10 animate-pulse" />
            <div className="relative w-24 h-24 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center">
              <svg className="w-12 h-12 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="4" height="4" rx="0.5" />
                <rect x="19" y="14" width="2" height="2" rx="0.5" />
                <rect x="14" y="19" width="2" height="2" rx="0.5" />
                <rect x="19" y="19" width="2" height="2" rx="0.5" />
              </svg>
            </div>
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-white/90">Escanea tu QR</h1>
            <p className="text-white/25 text-sm mt-2">Acerca tu escarapela al lector</p>
          </div>
        </div>
      </div>

      {/* Bottom: Schedule */}
      {schedule.length > 0 && (
        <div className="px-8 pb-6">
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 max-h-36 overflow-y-auto">
            <p className="text-white/20 text-[10px] font-bold uppercase tracking-widest mb-2">Agenda del salon</p>
            <div className="space-y-1.5">
              {schedule.map(s => (
                <div key={s.id} className="flex items-center gap-3 text-xs">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    s.status === 'live' ? 'bg-emerald-400' :
                    s.status === 'ended' ? 'bg-white/15' : 'bg-white/30'
                  }`} />
                  <span className={`font-mono w-12 flex-shrink-0 ${s.status === 'ended' ? 'text-white/20' : 'text-white/40'}`}>
                    {formatTime(s.starts_at)}
                  </span>
                  <span className={`truncate ${
                    s.status === 'live' ? 'text-emerald-300 font-medium' :
                    s.status === 'ended' ? 'text-white/20 line-through' : 'text-white/50'
                  }`}>
                    {s.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
