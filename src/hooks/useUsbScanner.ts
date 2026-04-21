import { useEffect, useRef } from 'react';

/**
 * Hook for USB/HID barcode/QR scanners.
 *
 * These devices act as keyboards — they type the scanned value
 * very fast (< 50ms between chars) and then send Enter.
 *
 * We detect this pattern: rapid keystrokes + Enter = scan result.
 * Human typing is too slow to trigger a false positive.
 */
export function useUsbScanner(
  onScan: (value: string) => void,
  active: boolean,
  options?: { minLength?: number; maxGap?: number }
) {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const bufferRef = useRef('');
  const lastKeyRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const minLength = options?.minLength ?? 8;  // QR tokens are at least 8 chars
  const maxGap = options?.maxGap ?? 80;       // Max ms between keystrokes from scanner

  useEffect(() => {
    if (!active) {
      bufferRef.current = '';
      return;
    }

    function handleKeyDown(e: KeyboardEvent) {
      const now = Date.now();

      // Enter = end of scan
      if (e.key === 'Enter') {
        e.preventDefault();
        const value = bufferRef.current.trim();
        bufferRef.current = '';

        if (value.length >= minLength) {
          onScanRef.current(value);
        }

        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        return;
      }

      // Only accept printable single characters
      if (e.key.length !== 1) return;

      // If too much time passed since last key, start fresh buffer
      if (now - lastKeyRef.current > maxGap) {
        bufferRef.current = '';
      }

      bufferRef.current += e.key;
      lastKeyRef.current = now;

      // Auto-clear buffer after 500ms of no input (safety)
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        bufferRef.current = '';
      }, 500);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [active, minLength, maxGap]);
}
