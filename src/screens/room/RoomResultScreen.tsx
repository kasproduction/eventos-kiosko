import { useEffect } from 'react';
import type { RoomScanSuccess } from '../../lib/room-api';

const ERROR_MESSAGES: Record<string, string> = {
  QR_INVALID:            'Codigo QR no valido',
  ATTENDEE_BANNED:       'Acceso denegado',
  NOT_CHECKED_IN_EVENT:  'No ha ingresado al evento',
  DEBOUNCE:              'Ya registrado',
  OFFLINE_QUEUED:        'Registrado offline',
  SIN_CONEXION:          'Sin conexion al servidor',
  ERROR_DESCONOCIDO:     'Error inesperado',
};

interface Props {
  success: RoomScanSuccess | null;
  errorCode: string | null;
  onDone: () => void;
}

export function RoomResultScreen({ success, errorCode, onDone }: Props) {
  const isOfflineQueued = errorCode === 'OFFLINE_QUEUED';
  const isSuccess = success !== null;
  const isCheckin = success?.type === 'checkin';

  // Auto-return after 4s (3s for offline)
  useEffect(() => {
    const t = setTimeout(onDone, isOfflineQueued ? 3000 : 4000);
    return () => clearTimeout(t);
  }, [onDone, isOfflineQueued]);

  // Offline queued — amber/yellow
  if (isOfflineQueued) {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center gap-8 cursor-pointer bg-amber-950"
        onClick={onDone}
      >
        <div className="text-8xl">📡</div>
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white">Registrado offline</h1>
          <p className="text-amber-300 text-xl mt-3">Se sincronizara al recuperar conexion</p>
        </div>
        <ProgressBar color="bg-amber-400" duration={3} />
      </div>
    );
  }

  // Error
  if (!isSuccess) {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center gap-8 cursor-pointer bg-red-950"
        onClick={onDone}
      >
        <div className="text-8xl">❌</div>
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white">Acceso no permitido</h1>
          <p className="text-red-300 text-xl mt-3">
            {ERROR_MESSAGES[errorCode ?? ''] ?? ERROR_MESSAGES['ERROR_DESCONOCIDO']}
          </p>
        </div>
        <ProgressBar color="bg-red-400" duration={4} />
      </div>
    );
  }

  // Success — checkin or checkout
  return (
    <div
      className={`w-full h-full flex flex-col items-center justify-center gap-8 cursor-pointer transition-colors duration-300 ${
        isCheckin ? 'bg-emerald-950' : 'bg-blue-950'
      }`}
      onClick={onDone}
    >
      <div className="text-7xl">{isCheckin ? '✅' : '👋'}</div>

      <div className="text-center">
        <h1 className="text-5xl font-bold text-white tracking-tight">
          {success.name}
        </h1>
        {success.session && (
          <p className={`text-xl mt-3 ${isCheckin ? 'text-emerald-300' : 'text-blue-300'}`}>
            {success.session}
          </p>
        )}
        {!isCheckin && success.minutes !== undefined && (
          <p className="text-blue-300/60 text-lg mt-2">
            Estuvo {success.minutes} min
          </p>
        )}
      </div>

      <p className={`text-2xl font-medium ${isCheckin ? 'text-emerald-300' : 'text-blue-300'}`}>
        {success.message}
      </p>

      <ProgressBar color={isCheckin ? 'bg-emerald-400' : 'bg-blue-400'} duration={4} />
    </div>
  );
}

function ProgressBar({ color, duration }: { color: string; duration: number }) {
  return (
    <div className="absolute bottom-0 left-0 h-1.5 bg-white/20 w-full">
      <div
        className={`h-full ${color}`}
        style={{ animation: `countdown ${duration}s linear forwards` }}
      />
      <style>{`
        @keyframes countdown {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  );
}
