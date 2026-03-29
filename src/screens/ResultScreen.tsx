import { useEffect } from 'react';
import type { CheckinSuccess } from '../lib/api';

const ERROR_MESSAGES: Record<string, string> = {
  QR_ALREADY_USED:       'Este QR ya fue utilizado',
  QR_INVALID:            'Código QR no válido',
  ATTENDEE_BANNED:       'Acceso denegado',
  EVENT_NOT_PUBLISHED:   'El evento no está activo',
  SIN_CONEXION:          'Sin conexión al servidor',
  ERROR_DESCONOCIDO:     'Error inesperado',
};

interface Props {
  success: CheckinSuccess | null;
  errorCode: string | null;
  onDone: () => void;
}

export function ResultScreen({ success, errorCode, onDone }: Props) {
  // Vuelve al idle automáticamente después de 4 segundos
  useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [onDone]);

  const isSuccess = success !== null;
  const avatarUrl = success?.user_photo
    ?? (success ? `https://ui-avatars.com/api/?name=${encodeURIComponent(success.user_name)}&size=256&background=6366f1&color=fff` : '');

  return (
    <div
      className={`w-full h-full flex flex-col items-center justify-center gap-8 cursor-pointer transition-colors duration-300 ${
        isSuccess ? 'bg-emerald-950' : 'bg-red-950'
      }`}
      onClick={onDone}
    >
      {isSuccess ? (
        <>
          {/* Foto */}
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-emerald-400/20 blur-2xl scale-150" />
            <img
              src={avatarUrl}
              alt={success.user_name}
              className="relative w-36 h-36 rounded-full object-cover border-4 border-emerald-400 shadow-xl"
            />
          </div>

          {/* Check animado */}
          <div className="text-7xl animate-bounce">✅</div>

          {/* Nombre + rol */}
          <div className="text-center">
            <h1 className="text-5xl font-bold text-white tracking-tight">
              {success.user_name}
            </h1>
            {success.stand_name ? (
              <p className="text-emerald-300 text-xl mt-2">{success.stand_name}</p>
            ) : (
              <p className="text-emerald-400/60 text-lg mt-2 capitalize">{success.role}</p>
            )}
          </div>

          <p className="text-emerald-300 text-2xl font-medium">¡Bienvenido!</p>
        </>
      ) : (
        <>
          <div className="text-8xl">❌</div>
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white">Acceso no permitido</h1>
            <p className="text-red-300 text-xl mt-3">
              {ERROR_MESSAGES[errorCode ?? ''] ?? ERROR_MESSAGES['ERROR_DESCONOCIDO']}
            </p>
          </div>
        </>
      )}

      {/* Barra de progreso countdown */}
      <div className="absolute bottom-0 left-0 h-1.5 bg-white/20 w-full">
        <div
          className={`h-full ${isSuccess ? 'bg-emerald-400' : 'bg-red-400'}`}
          style={{ animation: 'countdown 4s linear forwards' }}
        />
      </div>

      <style>{`
        @keyframes countdown {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  );
}
