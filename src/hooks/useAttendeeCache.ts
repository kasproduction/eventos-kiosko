import { useEffect, useRef, useCallback } from 'react';
import { getKioskConfig } from '../lib/config';

interface CachedAttendee {
  id: number;
  name: string;
}

/**
 * Local name cache for instant QR lookup.
 *
 * Only stores id → name. No state, no prediction, no consistency risk.
 * The API remains the source of truth for checkin/checkout/errors.
 *
 * - Full fetch on mount
 * - Delta every 60s (?since= returns only new/changed attendees)
 */
export function useAttendeeCache(totemToken: string) {
  const byIdRef = useRef<Map<number, string>>(new Map());
  const byTokenRef = useRef<Map<string, CachedAttendee>>(new Map());
  const lastFetchRef = useRef<string | null>(null);

  const fetchManifest = useCallback(async () => {
    if (!totemToken) return;
    const { apiUrl } = getKioskConfig();

    let url = `${apiUrl}/rooms/manifest`;
    if (lastFetchRef.current) {
      url += `?since=${encodeURIComponent(lastFetchRef.current)}`;
    }

    try {
      const res = await fetch(url, {
        headers: { 'X-Totem-Token': totemToken, Accept: 'application/json' },
      });
      if (!res.ok) return;
      const json = await res.json();
      if (!json.ok || !json.attendees) return;

      for (const a of json.attendees) {
        byIdRef.current.set(a.id, a.name);
        if (a.token) {
          byTokenRef.current.set(a.token, { id: a.id, name: a.name });
        }
      }

      lastFetchRef.current = json.generated_at;
    } catch {
      // Silent — cache is best-effort
    }
  }, [totemToken]);

  useEffect(() => {
    fetchManifest();
    const id = setInterval(fetchManifest, 60_000);
    return () => clearInterval(id);
  }, [fetchManifest]);

  /**
   * Lookup name from QR value. Returns name or null.
   * Dynamic: d.{attendee_id}.{window}.{sig} → lookup by ID
   * Static: lookup by token string
   */
  function lookupName(qrValue: string): string | null {
    if (qrValue.startsWith('d.')) {
      const parts = qrValue.split('.');
      if (parts.length >= 3) {
        const id = parseInt(parts[1], 10);
        if (!isNaN(id)) return byIdRef.current.get(id) ?? null;
      }
    }
    return byTokenRef.current.get(qrValue)?.name ?? null;
  }

  return { lookupName };
}
