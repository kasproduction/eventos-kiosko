import type { AttendanceState } from '../hooks/useAttendance';

interface Props {
  attendance: AttendanceState;
  onStartScan: () => void;
}

export function IdleScreen({ attendance, onStartScan }: Props) {
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-between bg-[#0f0f1a] text-white cursor-pointer"
      onClick={onStartScan}
    >
      {/* Top: aforo */}
      <div className="w-full flex justify-end px-10 pt-8">
        <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-3 text-center">
          <p className="text-xs text-white/40 uppercase tracking-widest mb-1">Aforo</p>
          <p className="text-3xl font-bold tabular-nums">
            {attendance.checkedIn}
            <span className="text-white/30 text-xl"> / {attendance.total}</span>
          </p>
        </div>
      </div>

      {/* Center: CTA */}
      <div className="flex flex-col items-center gap-8">
        {/* QR icon animated */}
        <div className="relative flex items-center justify-center">
          <div className="absolute w-56 h-56 rounded-full bg-indigo-500/10 animate-ping" />
          <div className="absolute w-44 h-44 rounded-full bg-indigo-500/15 animate-pulse" />
          <div className="relative w-36 h-36 rounded-3xl bg-white/5 border-2 border-white/20 flex items-center justify-center text-7xl">
            🔳
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-5xl font-bold tracking-tight">Escanea tu QR</h1>
          <p className="text-white/40 text-lg mt-3">Toca la pantalla o acerca tu código QR</p>
        </div>
      </div>

      {/* Bottom: branding */}
      <div className="pb-10">
        <p className="text-white/20 text-sm tracking-widest uppercase">EventOS · Acceso</p>
      </div>
    </div>
  );
}
