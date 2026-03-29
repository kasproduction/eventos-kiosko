import { useEffect, useRef } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { NotFoundException } from '@zxing/library';
import type { IScannerControls } from '@zxing/browser';

export function useQrScanner(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  onScan: (value: string) => void,
  active: boolean
) {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const controlsRef = useRef<IScannerControls | null>(null);

  useEffect(() => {
    if (!active || !videoRef.current) return;

    const reader = new BrowserMultiFormatReader();

    reader
      .decodeFromVideoDevice(undefined, videoRef.current, (result, err) => {
        if (result) {
          onScanRef.current(result.getText());
        } else if (err && !(err instanceof NotFoundException)) {
          console.warn('[scanner]', err);
        }
      })
      .then((controls) => {
        controlsRef.current = controls;
      })
      .catch((err) => console.error('[scanner] init error:', err));

    return () => {
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [active, videoRef]);
}
