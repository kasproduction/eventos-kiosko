import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useRoomTotem } from './hooks/useRoomTotem';
import { useUsbScanner } from './hooks/useUsbScanner';
import { useAttendeeCache } from './hooks/useAttendeeCache';
import type { RoomScanSuccess } from './lib/room-api';
import { getKioskConfig } from './lib/config';
import './kiosk.css';

type OverlayType = 'checkin' | 'checkout' | 'error' | 'offline' | null;

interface OverlayData {
  type: OverlayType;
  success: RoomScanSuccess | null;
  errorCode: string | null;
}

export default function RoomApp() {
  const { totemToken, roomName } = getKioskConfig();
  const { online, queueCount, schedule, roomName: serverRoomName, scan } = useRoomTotem(totemToken);
  const cache = useAttendeeCache(totemToken);

  const [overlay, setOverlay] = useState<OverlayData>({ type: null, success: null, errorCode: null });
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');

  const canvasRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const resultTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busyRef = useRef(false); // Synchronous gate — React state is async

  const displayName = serverRoomName || roomName || 'Salon';
  const liveSession = schedule.find(s => s.status === 'live');
  const nextSession = schedule.find(s => s.status === 'upcoming');

  // Auto-detect orientation from URL or viewport
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const forced = params.get('orientation');
    if (forced === 'portrait' || forced === 'landscape') {
      setOrientation(forced);
    } else {
      setOrientation(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');
    }
  }, []);

  // Wake Lock
  useEffect(() => {
    let wl: WakeLockSentinel | null = null;
    async function req() { try { if ('wakeLock' in navigator) wl = await navigator.wakeLock.request('screen'); } catch {} }
    req(); document.addEventListener('visibilitychange', req);
    return () => { wl?.release(); document.removeEventListener('visibilitychange', req); };
  }, []);

  // Stage scaling — fixed dimensions, not from DOM (which changes after scale)
  useEffect(() => {
    const W = orientation === 'landscape' ? 1920 : 1080;
    const H = orientation === 'landscape' ? 1080 : 1920;

    function applyScale() {
      const canvas = canvasRef.current;
      const inner = innerRef.current;
      if (!canvas || !inner) return;
      const s = Math.min(window.innerWidth / W, window.innerHeight / H);
      canvas.style.transform = `scale(${s})`;
      inner.style.width = `${W * s}px`;
      inner.style.height = `${H * s}px`;
    }
    applyScale();
    window.addEventListener('resize', applyScale);
    return () => window.removeEventListener('resize', applyScale);
  }, [orientation]);

  // Live clock
  const [clock, setClock] = useState({ time: '', date: '' });
  useEffect(() => {
    function tick() {
      const d = new Date();
      const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const date = `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
      setClock({ time, date });
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // QR scan handler — Opcion 2: cache solo nombres
  // 1. Lookup nombre en cache local → muestra INSTANTANEO
  // 2. API decide checkin/checkout/error → actualiza overlay
  // 3. Sin prediccion de estado, sin riesgo de inconsistencia
  const handleScan = useCallback(async (qrValue: string) => {
    if (busyRef.current) return;
    busyRef.current = true;

    // Instant: show name from cache while API processes
    const cachedName = cache.lookupName(qrValue);
    if (cachedName) {
      setOverlay({
        type: 'checkin', // Neutral — API will correct to checkout if needed
        success: { type: 'checkin', name: cachedName, session: null, color: '', message: 'Registrando...' },
        errorCode: null,
      });
    }

    // API is the source of truth
    const result = await scan(qrValue);

    if (result.ok) {
      setOverlay({
        type: result.data.type === 'checkin' ? 'checkin' : 'checkout',
        success: result.data,
        errorCode: null,
      });
    } else if (result.code === 'OFFLINE_QUEUED') {
      setOverlay({ type: 'offline', success: null, errorCode: result.code });
    } else {
      setOverlay({ type: 'error', success: null, errorCode: result.code });
    }

    // Auto-close overlay
    resultTimeout.current = setTimeout(() => {
      setOverlay({ type: null, success: null, errorCode: null });
      setTimeout(() => { busyRef.current = false; }, 500);
    }, 2500);
  }, [scan, cache]);

  useUsbScanner(handleScan, !busyRef.current);
  useEffect(() => () => { if (resultTimeout.current) clearTimeout(resultTimeout.current); }, []);

  // Minute tick — updates progress/timeline every 60s (not every second)
  const [minuteTick, setMinuteTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setMinuteTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Progress calculation
  const progress = useMemo(() => {
    if (!liveSession) return null;
    const start = new Date(liveSession.starts_at).getTime();
    const end = new Date(liveSession.ends_at).getTime();
    const now = Date.now();
    const total = Math.round((end - start) / 60000);
    const elapsed = Math.max(0, Math.round((now - start) / 60000));
    const pct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
    return { pct, elapsed, total, startTime: fmt(liveSession.starts_at) };
  }, [liveSession, minuteTick]);

  // Timeline NOW position
  const nowPosition = useMemo(() => {
    if (schedule.length === 0) return 0;
    const firstStart = new Date(schedule[0].starts_at).getTime();
    const lastEnd = new Date(schedule[schedule.length - 1].ends_at).getTime();
    const now = Date.now();
    return Math.min(100, Math.max(0, ((now - firstStart) / (lastEnd - firstStart)) * 100));
  }, [schedule, minuteTick]);

  // Duration format for next session
  const nextIn = useMemo(() => {
    if (!nextSession) return '';
    const mins = Math.max(0, Math.round((new Date(nextSession.starts_at).getTime() - Date.now()) / 60000));
    return `In ${mins} min`;
  }, [nextSession, minuteTick]);

  // Session duration in minutes
  function sessionDuration(s: { starts_at: string; ends_at: string }) {
    return Math.round((new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime()) / 60000);
  }

  // Not configured
  if (!totemToken) {
    return (
      <div className="k-stage">
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, fontFamily: 'var(--font-h)' }}>
          <p style={{ fontSize: 24, fontWeight: 600, color: 'var(--ink-50)' }}>Totem no configurado</p>
          <p className="k-label-sm" style={{ color: 'var(--ink-35)' }}>?mode=room&totem_token=XXX</p>
        </div>
      </div>
    );
  }

  const speakerInitials = liveSession?.speaker
    ? liveSession.speaker.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '';

  const nextSpeakerInitials = nextSession?.speaker
    ? nextSession.speaker.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '';

  return (
    <div className="k-stage">
      <div className="k-stage-inner" ref={innerRef}>
        <div className={`k-canvas ${orientation}`} ref={canvasRef}>


          {/* ============== LANDSCAPE ============== */}
          <div className="k-l">
            {/* Top */}
            <header className="k-l-top">
              <div className="k-l-room">
                <span className="k-label-sm" style={{ color: 'var(--ink-35)' }}>Room</span>
                <span className="k-l-room-name">{displayName}</span>
              </div>
              <div className="k-l-top-right">
                <div className="k-scan-pill">
                  <span className={`k-scan-dot ${!online ? 'offline' : ''}`} />
                  <span className="k-scan-label k-label-sm">
                    {!online ? 'Offline' : queueCount > 0 ? `${queueCount} queued` : 'Ready'}
                  </span>
                </div>
                <div>
                  <div className="k-l-clock">{clock.time}</div>
                  <div className="k-l-clock-date k-label-sm">{clock.date}</div>
                </div>
              </div>
            </header>

            {/* Hero */}
            <section className="k-l-hero">
              {liveSession ? (
                <>
                  <div>
                    <div className="k-l-hero-meta">
                      <div className="k-live-pill">
                        <span className="k-live-dot" />
                        <span className="k-live-label">Live Now</span>
                      </div>
                      {liveSession.track && (
                        <span className="k-label-sm" style={{ color: 'var(--ink-35)' }}>{liveSession.track}</span>
                      )}
                    </div>
                    <h1 className="k-l-title">{liveSession.title}</h1>
                    <div className="k-l-meta-grid">
                      <div className="k-l-meta-cell">
                        <span className="k-label-sm" style={{ color: 'var(--ink-35)' }}>Time</span>
                        <span className="k-l-meta-v">{fmt(liveSession.starts_at)} — {fmt(liveSession.ends_at)}</span>
                      </div>
                      <div className="k-l-meta-cell">
                        <span className="k-label-sm" style={{ color: 'var(--ink-35)' }}>Format</span>
                        <span className="k-l-meta-v">{liveSession.type || 'Session'}    {sessionDuration(liveSession)} min</span>
                      </div>
                    </div>
                    {progress && (
                      <div className="k-l-progress k-progress">
                        <div className="k-progress-track">
                          <div className="k-progress-fill" style={{ width: `${progress.pct}%` }} />
                        </div>
                        <div className="k-progress-meta k-label-sm">
                          <span>Started {progress.startTime}</span>
                          <span>{progress.elapsed} of {progress.total} min</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <aside>
                    {liveSession.speaker && (
                      <div className="k-l-speaker">
                        <div className="k-l-speaker-photo">
                          {liveSession.speaker_photo
                            ? <img src={liveSession.speaker_photo} alt="" />
                            : <span className="initials">{speakerInitials}</span>
                          }
                        </div>
                        <div className="k-l-speaker-info">
                          <span className="k-label-sm" style={{ color: 'var(--ink-35)' }}>Speaker</span>
                          <span className="k-l-speaker-name">{liveSession.speaker}</span>
                          {liveSession.speaker_role && (
                            <span className="k-l-speaker-role">{liveSession.speaker_role}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </aside>
                </>
              ) : nextSession ? (
                <div>
                  <div className="k-l-hero-meta">
                    <span className="k-label-sm" style={{ color: 'var(--ink-35)' }}>Up Next    {nextIn}</span>
                  </div>
                  <h1 className="k-l-title" style={{ color: 'var(--ink-70)', fontSize: 72 }}>{nextSession.title}</h1>
                  {nextSession.speaker && (
                    <p style={{ fontFamily: 'var(--font-b)', fontSize: 20, color: 'var(--ink-35)', marginTop: 8 }}>
                      {nextSession.speaker}
                    </p>
                  )}
                </div>
              ) : (
                <div className="k-empty">
                  <h2 className="k-empty-title">No sessions</h2>
                  <p className="k-empty-sub">Scanner active</p>
                </div>
              )}
            </section>

            {/* Bottom zone */}
            <div className="k-l-bottom">
              {nextSession && liveSession && (
                <section className="k-l-next">
                  <span className="k-label-sm" style={{ color: 'var(--ink-35)' }}>Up Next</span>
                  <div>
                    <span className="k-l-next-title">{nextSession.title}</span>
                    {nextSession.speaker && <p className="k-l-next-speaker">{nextSession.speaker}</p>}
                  </div>
                  <div>
                    <div className="k-l-next-time">{fmt(nextSession.starts_at)} — {fmt(nextSession.ends_at)}</div>
                    <div className="k-l-next-in k-label-sm">{nextIn}</div>
                  </div>
                </section>
              )}
              {schedule.length > 0 && (
                <section className="k-l-timeline">
                  {nextSession && liveSession && <div className="k-l-tl-sep" />}
                  <div className="k-l-tl-head k-label-sm">
                    <span>Today    {displayName}</span>
                    <span>{schedule.length} sessions</span>
                  </div>
                  <div className="k-l-tl-track">
                    {schedule.map(s => (
                      <div key={s.id} className={`k-tl-slot ${s.status === 'ended' ? 'past' : ''} ${s.status === 'live' ? 'live' : ''}`}>
                        <span className="k-tl-time">{fmt(s.starts_at)}</span>
                        <span className="k-tl-name">{s.title}</span>
                      </div>
                    ))}
                    <div className="k-tl-now" style={{ left: `${nowPosition}%` }} />
                  </div>
                </section>
              )}
            </div>

            {/* Footer */}
            <footer className="k-l-footer">
              <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
                <span className="k-foot-brand">EventOS</span>
                <span className="k-foot-meta k-label-sm">Kiosk    {displayName}</span>
              </div>
              <span className="k-foot-meta k-label-sm">Synced {clock.time}</span>
            </footer>
          </div>

          {/* ============== PORTRAIT ============== */}
          <div className="k-p">
            <header className="k-p-top">
              <div className="k-p-room">
                <span className="k-label-sm" style={{ color: 'var(--ink-35)' }}>Room</span>
                <span className="k-p-room-name">{displayName}</span>
              </div>
              <div className="k-p-top-right">
                <div className="k-scan-pill">
                  <span className={`k-scan-dot ${!online ? 'offline' : ''}`} />
                  <span className="k-scan-label k-label-sm">
                    {!online ? 'Offline' : 'Ready'}
                  </span>
                </div>
                <div>
                  <div className="k-p-clock">{clock.time}</div>
                  <div className="k-p-clock-date k-label-sm">{clock.date}</div>
                </div>
              </div>
            </header>

            <section className="k-p-hero">
              {liveSession ? (
                <>
                  <div className="k-p-live-row">
                    <div className="k-live-pill">
                      <span className="k-live-dot" />
                      <span className="k-live-label">Live Now</span>
                    </div>
                    <span className="k-p-time-range">{fmt(liveSession.starts_at)} — {fmt(liveSession.ends_at)}</span>
                  </div>
                  <h1 className="k-p-title">{liveSession.title}</h1>
                  {liveSession.speaker && (
                    <div className="k-p-speaker">
                      <div className="k-p-speaker-photo">
                        {liveSession.speaker_photo
                          ? <img src={liveSession.speaker_photo} alt="" />
                          : <span className="initials">{speakerInitials}</span>
                        }
                      </div>
                      <div>
                        <div className="k-p-speaker-name">{liveSession.speaker}</div>
                        {liveSession.speaker_role && <div className="k-p-speaker-role">{liveSession.speaker_role}</div>}
                      </div>
                    </div>
                  )}
                  <div className="k-p-meta-row">
                    <div className="k-p-meta-cell">
                      <span className="k-label-sm" style={{ color: 'var(--ink-35)' }}>Format</span>
                      <span className="k-p-meta-v">{liveSession.type || 'Session'}    {sessionDuration(liveSession)} min</span>
                    </div>
                    {liveSession.track && (
                      <div className="k-p-meta-cell">
                        <span className="k-label-sm" style={{ color: 'var(--ink-35)' }}>Track</span>
                        <span className="k-p-meta-v">{liveSession.track}</span>
                      </div>
                    )}
                  </div>
                  {progress && (
                    <div className="k-progress">
                      <div className="k-progress-track">
                        <div className="k-progress-fill" style={{ width: `${progress.pct}%` }} />
                      </div>
                      <div className="k-progress-meta k-label-sm">
                        <span>Started {progress.startTime}</span>
                        <span>{progress.elapsed} of {progress.total} min</span>
                      </div>
                    </div>
                  )}
                </>
              ) : nextSession ? (
                <>
                  <div className="k-p-live-row">
                    <span className="k-label" style={{ color: 'var(--ink-35)' }}>Up Next    {nextIn}</span>
                  </div>
                  <h1 className="k-p-title" style={{ color: 'var(--ink-70)' }}>{nextSession.title}</h1>
                  {nextSession.speaker && (
                    <div className="k-p-speaker">
                      <div className="k-p-speaker-photo">
                        <span className="initials">{nextSpeakerInitials}</span>
                      </div>
                      <div>
                        <div className="k-p-speaker-name" style={{ color: 'var(--ink-70)' }}>{nextSession.speaker}</div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="k-empty">
                  <h2 className="k-empty-title">No sessions</h2>
                  <p className="k-empty-sub">Scanner active</p>
                </div>
              )}
            </section>

            <div className="k-p-bottom">
              {nextSession && liveSession && (
                <section className="k-p-next">
                  <div className="k-p-next-header">
                    <span className="k-label-sm" style={{ color: 'var(--ink-35)' }}>Up Next</span>
                    <span className="k-p-next-time">{fmt(nextSession.starts_at)} — {fmt(nextSession.ends_at)}    {nextIn}</span>
                  </div>
                  <span className="k-p-next-title">{nextSession.title}</span>
                  {nextSession.speaker && <span className="k-p-next-speaker">{nextSession.speaker}</span>}
                </section>
              )}

              {schedule.length > 0 && (
                <section className="k-p-timeline">
                  <div className="k-p-tl-sep" />
                  <div className="k-p-tl-head k-label-sm">
                    <span>Today    {displayName}</span>
                    <span>{schedule.length} sessions</span>
                  </div>
                  <div className="k-p-tl-track">
                    {schedule.map(s => (
                      <div key={s.id} className={`k-tl-slot ${s.status === 'ended' ? 'past' : ''} ${s.status === 'live' ? 'live' : ''}`}>
                        <span className="k-tl-time">{fmt(s.starts_at)}</span>
                        <span className="k-tl-name">{truncate(s.title, 12)}</span>
                      </div>
                    ))}
                    <div className="k-tl-now" style={{ left: `${nowPosition}%` }} />
                  </div>
                </section>
              )}

              <footer className="k-p-footer">
                <span className="k-foot-brand">EventOS</span>
                <span className="k-foot-meta k-label-sm">Synced {clock.time}</span>
              </footer>
            </div>
          </div>

          {/* ============== OVERLAY ============== */}
          <div
            className={`k-overlay ${overlay.type ?? ''} ${overlay.type ? 'show' : ''}`}
            onClick={() => {
              if (resultTimeout.current) clearTimeout(resultTimeout.current);
              setOverlay({ type: null, success: null, errorCode: null });
              setTimeout(() => { busyRef.current = false; }, 1000);
            }}
          >
            <div className="k-ov-content">
              <span className="k-ov-timer k-label">
                {overlay.type === 'offline' ? '3s' : '2.5s'}
              </span>

              <div className="k-ov-eyebrow">
                <span className="k-ov-dot" />
                <span className="k-ov-status">
                  {overlay.type === 'checkin' && 'Check-in    Entrada'}
                  {overlay.type === 'checkout' && 'Check-out    Salida'}
                  {overlay.type === 'error' && 'Error    No valido'}
                  {overlay.type === 'offline' && 'Offline    En cola'}
                </span>
              </div>

              <div className="k-ov-greeting">
                {overlay.type === 'checkin' && 'Bienvenido,'}
                {overlay.type === 'checkout' && 'Hasta luego,'}
                {overlay.type === 'error' && 'Scan not recognized'}
                {overlay.type === 'offline' && 'Queued for sync'}
              </div>

              <div className="k-ov-name">
                {overlay.success
                  ? overlay.success.name
                  : overlay.type === 'error'
                    ? getErrorMessage(overlay.errorCode)
                    : 'Offline'
                }
              </div>

              <div className="k-ov-session">
                {overlay.success?.session && overlay.type === 'checkin' && overlay.success.session}
                {overlay.success && overlay.type === 'checkout' && overlay.success.minutes !== undefined
                  ? `You stayed ${overlay.success.minutes} minutes`
                  : overlay.type === 'checkout' && overlay.success?.session
                }
                {overlay.type === 'error' && 'Please visit the registration desk.'}
                {overlay.type === 'offline' && 'Will sync when connection is restored.'}
              </div>

              <div className="k-ov-stats">
                {overlay.type === 'checkin' && overlay.success && (
                  <>
                    <div className="k-ov-stat">
                      <div className="k-ov-stat-k k-label-sm">Entry</div>
                      <div className="k-ov-stat-v">{clock.time}</div>
                    </div>
                  </>
                )}
                {overlay.type === 'checkout' && overlay.success && (
                  <>
                    <div className="k-ov-stat">
                      <div className="k-ov-stat-k k-label-sm">Duration</div>
                      <div className="k-ov-stat-v">{overlay.success.minutes ?? 0} min</div>
                    </div>
                    <div className="k-ov-stat">
                      <div className="k-ov-stat-k k-label-sm">Left</div>
                      <div className="k-ov-stat-v">{clock.time}</div>
                    </div>
                  </>
                )}
                {overlay.type === 'error' && (
                  <>
                    <div className="k-ov-stat">
                      <div className="k-ov-stat-k k-label-sm">Code</div>
                      <div className="k-ov-stat-v">{overlay.errorCode ?? 'ERR'}</div>
                    </div>
                    <div className="k-ov-stat">
                      <div className="k-ov-stat-k k-label-sm">Time</div>
                      <div className="k-ov-stat-v">{clock.time}</div>
                    </div>
                  </>
                )}
                {overlay.type === 'offline' && (
                  <div className="k-ov-stat">
                    <div className="k-ov-stat-k k-label-sm">Queue</div>
                    <div className="k-ov-stat-v">{queueCount} pending</div>
                  </div>
                )}
              </div>

              <div className="k-ov-bar">
                {overlay.type && <div className="k-ov-bar-fill" key={Date.now()} />}
              </div>
            </div>
          </div>


        </div>
      </div>
    </div>
  );
}

/* ============== HELPERS ============== */

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function truncate(str: string, max: number) {
  if (str.length <= max) return str;
  return str.slice(0, max).trimEnd() + '...';
}

function getErrorMessage(code: string | null): string {
  switch (code) {
    case 'QR_INVALID': return 'QR not valid';
    case 'ATTENDEE_BANNED': return 'Access denied';
    case 'NOT_CHECKED_IN_EVENT': return 'Not checked in';
    case 'DEBOUNCE': return 'Already scanned';
    default: return 'Unknown error';
  }
}
