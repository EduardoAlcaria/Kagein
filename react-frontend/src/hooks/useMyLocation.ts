// react-frontend/src/hooks/useMyLocation.ts
import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { updateMyLocation } from '../api/client';

export type MyLocationCoords = { latitude: number; longitude: number };
export type GeoStatus = 'idle' | 'granted' | 'denied';

const POLL_MS = 60_000;

export function useMyLocation(enabled: boolean): { coords: MyLocationCoords | null; status: GeoStatus } {
  const [coords, setCoords] = useState<MyLocationCoords | null>(null);
  const [status, setStatus] = useState<GeoStatus>('idle');

  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !navigator.geolocation) {
      setCoords(null);
      setStatus('idle');
      return;
    }
    const capture = () => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
          setStatus('granted');
        },
        () => {
          setCoords(null);
          setStatus('denied');
        },
      );
    };
    capture();
    const timer = setInterval(capture, POLL_MS);
    return () => clearInterval(timer);
  }, [enabled]);

  return { coords, status };
}

export function useUpdateMyLocation() {
  return useMutation({ mutationFn: (coords: MyLocationCoords) => updateMyLocation(coords) });
}
