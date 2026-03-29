import { useState, useCallback, useEffect } from 'react';
import { IdleScreen } from './screens/IdleScreen';
import { ScanScreen } from './screens/ScanScreen';
import { ResultScreen } from './screens/ResultScreen';
import { useAttendance } from './hooks/useAttendance';
import { processCheckin, type CheckinSuccess } from './lib/api';
import { getKioskConfig } from './lib/config';

type Screen = 'idle' | 'scan' | 'result';

const { eventId, token } = getKioskConfig();

function generateIdempotencyKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('idle');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState<CheckinSuccess | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const attendance = useAttendance(eventId);

  // Mantener pantalla encendida (Screen Wake Lock API)
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;

    async function requestWakeLock() {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch { /* best-effort */ }
    }

    requestWakeLock();
    document.addEventListener('visibilitychange', requestWakeLock);

    return () => {
      wakeLock?.release();
      document.removeEventListener('visibilitychange', requestWakeLock);
    };
  }, []);

  const handleScan = useCallback(async (qrValue: string) => {
    if (processing) return;
    setProcessing(true);

    const result = await processCheckin(
      qrValue,
      eventId,
      token,
      generateIdempotencyKey()
    );

    if (result.ok) {
      setSuccess(result.data);
      setErrorCode(null);
    } else {
      setSuccess(null);
      setErrorCode(result.code);
    }

    setScreen('result');
    setProcessing(false);
  }, [processing]);

  const handleDone = useCallback(() => {
    setScreen('idle');
    setSuccess(null);
    setErrorCode(null);
  }, []);

  if (!eventId || !token) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#0f0f1a] text-white gap-4 px-8 text-center">
        <p className="text-6xl">⚙️</p>
        <h1 className="text-2xl font-bold">Kiosco no configurado</h1>
        <p className="text-white/40 text-base">
          Agrega <code className="bg-white/10 px-2 py-1 rounded text-sm">?event_id=X&token=TOKEN</code> a la URL
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      {screen === 'idle' && (
        <IdleScreen
          attendance={attendance}
          onStartScan={() => setScreen('scan')}
        />
      )}
      {screen === 'scan' && (
        <ScanScreen
          scanning={screen === 'scan'}
          onScan={handleScan}
          onCancel={() => setScreen('idle')}
        />
      )}
      {screen === 'result' && (
        <ResultScreen
          success={success}
          errorCode={errorCode}
          onDone={handleDone}
        />
      )}

      {processing && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="w-16 h-16 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
