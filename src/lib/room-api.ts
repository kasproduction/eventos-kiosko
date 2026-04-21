import { getKioskConfig } from './config';

export interface RoomScanSuccess {
  type: 'checkin' | 'checkout';
  name: string;
  session: string | null;
  color: string;
  message: string;
  minutes?: number;
}

export type RoomScanResult =
  | { ok: true; data: RoomScanSuccess }
  | { ok: false; code: string };

export async function processRoomScan(
  qrToken: string,
  totemToken: string
): Promise<RoomScanResult> {
  const { apiUrl } = getKioskConfig();

  try {
    const res = await fetch(`${apiUrl}/rooms/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Totem-Token': totemToken,
      },
      body: JSON.stringify({ qr_token: qrToken }),
    });

    const json = await res.json().catch(() => ({}));

    if (res.ok && json.type !== 'error') {
      return { ok: true, data: json };
    }

    return { ok: false, code: json.code ?? json.message ?? 'ERROR_DESCONOCIDO' };
  } catch {
    return { ok: false, code: 'SIN_CONEXION' };
  }
}

export async function processRoomScanBatch(
  scans: Array<{ qr_token: string; device_timestamp: string }>,
  totemToken: string
): Promise<{ processed: number }> {
  const { apiUrl } = getKioskConfig();

  try {
    const res = await fetch(`${apiUrl}/rooms/scan/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Totem-Token': totemToken,
      },
      body: JSON.stringify({ scans }),
    });

    const json = await res.json().catch(() => ({ processed: 0 }));
    return { processed: json.processed ?? 0 };
  } catch {
    return { processed: 0 };
  }
}

export interface PingResult {
  ok: boolean;
  timestamp?: string;
  session?: { id: number; title: string; starts_at: string; ends_at: string } | null;
}

export async function pingTotem(totemToken: string): Promise<PingResult> {
  const { apiUrl } = getKioskConfig();

  console.log('[ping] token:', totemToken ? totemToken.slice(0, 10) + '...' : 'EMPTY', 'url:', apiUrl);

  try {
    const res = await fetch(`${apiUrl}/rooms/ping`, {
      headers: { 'X-Totem-Token': totemToken, Accept: 'application/json' },
    });

    console.log('[ping] status:', res.status);
    if (!res.ok) return { ok: false };
    return await res.json();
  } catch (e) {
    console.error('[ping] error:', e);
    return { ok: false };
  }
}
