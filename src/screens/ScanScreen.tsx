import { useRef, useEffect } from 'react';
import { useQrScanner } from '../hooks/useQrScanner';

interface Props {
  onScan: (token: string) => void;
  onCancel: () => void;
  scanning: boolean;
}

export function ScanScreen({ onScan, onCancel, scanning }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannedRef = useRef(false);

  const handleScan = (value: string) => {
    if (scannedRef.current) return;  // debounce: una sola lectura
    scannedRef.current = true;
    onScan(value);
  };

  useQrScanner(videoRef, handleScan, scanning);

  // Reset debounce cuando se vuelve a activar
  useEffect(() => {
    if (scanning) scannedRef.current = false;
  }, [scanning]);

  return (
    <div className="w-full h-full relative bg-black flex items-center justify-center">
      {/* Camera feed */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover opacity-80"
        muted
        playsInline
      />

      {/* Overlay oscuro con recuadro de escaneo */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Frame de escaneo */}
        <div className="relative w-64 h-64">
          {/* Esquinas del frame */}
          <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
          <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
          <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
          <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />
          {/* Línea de escaneo animada */}
          <div className="absolute inset-x-2 top-2 h-0.5 bg-indigo-400/80 animate-[scan_2s_ease-in-out_infinite]" />
        </div>

        <p className="text-white/70 text-lg text-center">
          Centra el código QR en el recuadro
        </p>
      </div>

      {/* Botón cancelar */}
      <button
        onClick={onCancel}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 px-8 py-3 rounded-full bg-white/10 border border-white/20 text-white text-base hover:bg-white/20 transition-colors"
      >
        Cancelar
      </button>

      <style>{`
        @keyframes scan {
          0%, 100% { top: 0.5rem; opacity: 1; }
          50%       { top: calc(100% - 0.5rem); opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
