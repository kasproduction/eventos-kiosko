import { useState, useCallback, useEffect, useRef } from 'react';
import { useRoomTotem } from './hooks/useRoomTotem';
import { useQrScanner } from './hooks/useQrScanner';
import type { RoomScanSuccess } from './lib/room-api';
import { getKioskConfig } from './lib/config';

type State = 'scanning' | 'result';

export default function RoomApp() {
  const { totemToken, roomName } = getKioskConfig();
  const { online, queueCount, schedule, roomName: serverRoomName, scan } = useRoomTotem(totemToken);

  const [state, setState] = useState<State>('scanning');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState<RoomScanSuccess | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const resultTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayName = serverRoomName || roomName || 'Salon';
  const liveSession = schedule.find(s => s.status === 'live');
  const nextSession = schedule.find(s => s.status === 'upcoming');

  // Wake Lock
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;
    async function req() { try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch {} }
    req();
    document.addEventListener('visibilitychange', req);
    return () => { wakeLock?.release(); document.removeEventListener('visibilitychange', req); };
  }, []);

  // Scanner always active when in scanning state
  const lastScanRef = useRef<string>('');
  const cooldownRef = useRef(false);

  const handleScan = useCallback(async (qrValue: string) => {
    if (processing || state !== 'scanning' || cooldownRef.current) return;
    // Ignore same QR within 5 seconds (person still in front of camera)
    if (qrValue === lastScanRef.current) return;
    lastScanRef.current = qrValue;
    cooldownRef.current = true;
    setProcessing(true);

    // Reset cooldown after 5s (allows same person to scan again later)
    setTimeout(() => { cooldownRef.current = false; lastScanRef.current = ''; }, 5000);

    const result = await scan(qrValue);

    if (result.ok) {
      setSuccess(result.data);
      setErrorCode(null);
    } else {
      setSuccess(null);
      setErrorCode(result.code);
    }

    setState('result');
    setProcessing(false);

    // Auto-return to scanning after 4s
    resultTimeout.current = setTimeout(() => {
      setState('scanning');
      setSuccess(null);
      setErrorCode(null);
    }, 4000);
  }, [processing, state, scan]);

  useQrScanner(videoRef, handleScan, state === 'scanning');

  // Cleanup timeout
  useEffect(() => () => { if (resultTimeout.current) clearTimeout(resultTimeout.current); }, []);

  if (!totemToken) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#0a0a14] text-white gap-4 px-8 text-center">
        <h1 className="text-2xl font-bold">Totem no configurado</h1>
        <p className="text-white/40 text-sm">?mode=room&totem_token=XXX</p>
      </div>
    );
  }

  // ── RESULT OVERLAY ──
  if (state === 'result') {
    const isSuccess = success !== null;
    const isCheckin = success?.type === 'checkin';
    const isOffline = errorCode === 'OFFLINE_QUEUED';

    return (
      <div className={`w-full h-full flex flex-col items-center justify-center gap-6 transition-colors duration-300 ${
        isOffline ? 'bg-amber-950' :
        isSuccess ? (isCheckin ? 'bg-emerald-950' : 'bg-blue-950') : 'bg-red-950'
      }`} onClick={() => { setState('scanning'); if (resultTimeout.current) clearTimeout(resultTimeout.current); }}>

        {isOffline && (
          <>
            <div className="text-7xl">📡</div>
            <h1 className="text-3xl font-bold text-white">Registrado offline</h1>
            <p className="text-amber-300 text-lg">Se sincronizara al reconectar</p>
          </>
        )}

        {!isOffline && isSuccess && (
          <>
            <div className="text-6xl">{isCheckin ? '✓' : '👋'}</div>
            <h1 className="text-4xl font-bold text-white">{success.name}</h1>
            {success.session && <p className={`text-lg ${isCheckin ? 'text-emerald-300' : 'text-blue-300'}`}>{success.session}</p>}
            {!isCheckin && success.minutes !== undefined && <p className="text-blue-300/60">Estuvo {success.minutes} min</p>}
            <p className={`text-2xl font-medium ${isCheckin ? 'text-emerald-300' : 'text-blue-300'}`}>{success.message}</p>
          </>
        )}

        {!isOffline && !isSuccess && (
          <>
            <div className="text-6xl">✕</div>
            <h1 className="text-3xl font-bold text-white">Acceso no permitido</h1>
            <p className="text-red-300 text-lg">{
              errorCode === 'QR_INVALID' ? 'Codigo QR no valido' :
              errorCode === 'ATTENDEE_BANNED' ? 'Acceso denegado' :
              errorCode === 'NOT_CHECKED_IN_EVENT' ? 'No ha ingresado al evento' :
              errorCode === 'DEBOUNCE' ? 'Ya registrado' : 'Error'
            }</p>
          </>
        )}

        {/* Countdown bar */}
        <div className="absolute bottom-0 left-0 h-1 bg-white/10 w-full">
          <div className={`h-full ${isSuccess ? (isCheckin ? 'bg-emerald-400' : 'bg-blue-400') : 'bg-red-400'}`}
            style={{ animation: 'countdown 4s linear forwards' }} />
        </div>
        <style>{`@keyframes countdown { from { width: 100%; } to { width: 0%; } }`}</style>
      </div>
    );
  }

  // ── SCANNING STATE (always active) ──
  return (
    <div className="w-full h-full relative bg-[#0a0a14] overflow-hidden">
      {/* Camera — hidden but active (scans QR without showing viewfinder) */}
      <video
        ref={videoRef}
        className="absolute w-1 h-1 opacity-0 pointer-events-none"
        muted
        playsInline
      />

      {/* Overlay content */}
      <div className="relative z-10 w-full h-full flex flex-col">

        {/* Header */}
        <header className="flex items-center justify-between px-8 pt-6 pb-3">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${online ? 'bg-emerald-400' : 'bg-red-500 animate-pulse'}`} />
            <span className="text-white/30 text-xs font-medium uppercase tracking-wider">
              {online ? 'En linea' : 'Offline'}
            </span>
            {queueCount > 0 && (
              <span className="bg-amber-500/15 text-amber-400 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                {queueCount} en cola
              </span>
            )}
          </div>
          <div className="text-white/40 text-sm font-semibold tracking-wide uppercase">{displayName}</div>
        </header>

        {/* Session info */}
        {liveSession && (
          <div className="mx-8 mb-3 bg-black/40 backdrop-blur-sm border border-emerald-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest">En vivo</span>
            </div>
            <h2 className="text-xl font-bold text-white">{liveSession.title}</h2>
            {liveSession.speaker && <p className="text-white/40 text-sm">{liveSession.speaker}</p>}
            <p className="text-emerald-300/50 text-xs mt-1 font-mono">
              {fmt(liveSession.starts_at)} — {fmt(liveSession.ends_at)}
            </p>
          </div>
        )}

        {!liveSession && nextSession && (
          <div className="mx-8 mb-3 bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl p-4">
            <span className="text-white/30 text-[10px] font-bold uppercase tracking-widest">Siguiente</span>
            <h2 className="text-lg font-bold text-white mt-1">{nextSession.title}</h2>
            <p className="text-white/30 text-xs mt-1 font-mono">{fmt(nextSession.starts_at)} — {fmt(nextSession.ends_at)}</p>
          </div>
        )}

        {/* Center: scan ready indicator */}
        <div className="flex-1 flex flex-col items-center justify-center gap-5">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-28 h-28 rounded-full bg-emerald-500/5 animate-ping" style={{ animationDuration: '3s' }} />
            <div className="w-20 h-20 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center">
              <svg className="w-10 h-10 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
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
            <p className="text-white/50 text-base font-medium">Acerca tu escarapela</p>
            <p className="text-white/20 text-xs mt-1">El lector esta activo</p>
          </div>
        </div>

        {/* Bottom: mini schedule */}
        {schedule.length > 0 && (
          <div className="px-8 pb-5">
            <div className="bg-black/40 backdrop-blur-sm border border-white/[0.06] rounded-lg p-3 max-h-28 overflow-y-auto">
              <div className="space-y-1">
                {schedule.map(s => (
                  <div key={s.id} className="flex items-center gap-2 text-[11px]">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      s.status === 'live' ? 'bg-emerald-400' : s.status === 'ended' ? 'bg-white/15' : 'bg-white/30'
                    }`} />
                    <span className={`font-mono w-10 flex-shrink-0 ${s.status === 'ended' ? 'text-white/20' : 'text-white/40'}`}>
                      {fmt(s.starts_at)}
                    </span>
                    <span className={`truncate ${
                      s.status === 'live' ? 'text-emerald-300 font-medium' : s.status === 'ended' ? 'text-white/20' : 'text-white/40'
                    }`}>{s.title}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Processing spinner */}
      {processing && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="w-14 h-14 border-3 border-white/20 border-t-emerald-400 rounded-full animate-spin" />
        </div>
      )}

    </div>
  );
}

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
}
