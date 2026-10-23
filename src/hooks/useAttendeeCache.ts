import { useEffect, useRef, useCallback, useState } from 'react';
import { getKioskConfig } from '../lib/config';

interface CachedAttendee {
  id: number;
  name: string;
  avatar_url?: string | null;
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
  const [cachedCount, setCachedCount] = useState(0);

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
        // El backend manda el sha256 del QR estatico, nunca el QR (BUG-418)
        if (a.token_hash) {
          byTokenRef.current.set(a.token_hash, { id: a.id, name: a.name, avatar_url: a.avatar_url });
        }
      }

      lastFetchRef.current = json.generated_at;
      setCachedCount(byIdRef.current.size);
    } catch {
      // Silent — cache is best-effort
    }
  }, [totemToken]);

  useEffect(() => {
    fetchManifest();
    const id = setInterval(fetchManifest, 60_000);
    return () => clearInterval(id);
  }, [fetchManifest]);

  /** sha256 hex del QR leido: el cache de QR estaticos va por hash. */
  async function hashOf(qrValue: string): Promise<string> {
    // Sin contexto seguro (http por IP) no hay crypto.subtle: sin nombre instantaneo, el scan sigue
    if (!globalThis.crypto?.subtle) return '';
    try {
      const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(qrValue));
      return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      return '';
    }
  }

  /**
   * Lookup name from QR value. Returns name or null.
   * Dynamic: d.{attendee_id}.{window}.{sig} → lookup by ID
   * Static: lookup by sha256 of the token
   */
  async function lookupName(qrValue: string): Promise<string | null> {
    if (qrValue.startsWith('d.')) {
      const parts = qrValue.split('.');
      if (parts.length >= 3) {
        const id = parseInt(parts[1], 10);
        if (!isNaN(id)) return byIdRef.current.get(id) ?? null;
      }
    }
    return byTokenRef.current.get(await hashOf(qrValue))?.name ?? null;
  }

  async function lookupAvatar(qrValue: string): Promise<string | null> {
    if (qrValue.startsWith('d.')) {
      const parts = qrValue.split('.');
      if (parts.length >= 3) {
        const id = parseInt(parts[1], 10);
        if (!isNaN(id)) {
          for (const entry of byTokenRef.current.values()) {
            if (entry.id === id) return entry.avatar_url ?? null;
          }
        }
      }
    }
    return byTokenRef.current.get(await hashOf(qrValue))?.avatar_url ?? null;
  }

  return { lookupName, lookupAvatar, cachedCount };
}
