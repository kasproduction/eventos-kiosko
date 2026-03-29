import { getKioskConfig } from './config';

export interface CheckinSuccess {
  user_name: string;
  user_photo: string | null;
  role: string;
  stand_name: string | null;
  checked_in_at: string;
}

export type CheckinResult =
  | { ok: true; data: CheckinSuccess }
  | { ok: false; code: string };

export async function processCheckin(
  qrToken: string,
  eventId: number,
  token: string,
  idempotencyKey: string
): Promise<CheckinResult> {
  const { apiUrl } = getKioskConfig();

  try {
    const res = await fetch(`${apiUrl}/checkin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ qr_token: qrToken, event_id: eventId }),
    });

    const json = await res.json().catch(() => ({}));

    if (res.ok) {
      return { ok: true, data: json.data };
    }

    return { ok: false, code: json.code ?? 'ERROR_DESCONOCIDO' };
  } catch {
    return { ok: false, code: 'SIN_CONEXION' };
  }
}
