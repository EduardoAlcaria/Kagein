// react-frontend/src/hooks/useMyLocation.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMyLocation } from './useMyLocation';

describe('useMyLocation', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('captures a fix on mount and again after 60s when enabled', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) =>
      success({ coords: { latitude: -23.56, longitude: -46.65 } } as GeolocationPosition),
    );
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });

    const { result } = renderHook(() => useMyLocation(true));

    await waitFor(() => expect(result.current.status).toBe('granted'));
    expect(result.current.coords).toEqual({ latitude: -23.56, longitude: -46.65 });
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60_000);
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
  });

  it('reports denied and null coords when permission is refused', async () => {
    const getCurrentPosition = vi.fn(
      (_success: PositionCallback, error: PositionErrorCallback) =>
        error({ code: 1, message: 'denied' } as GeolocationPositionError),
    );
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });

    const { result } = renderHook(() => useMyLocation(true));

    await waitFor(() => expect(result.current.status).toBe('denied'));
    expect(result.current.coords).toBeNull();
  });

  it('stays idle and never polls when disabled', () => {
    const getCurrentPosition = vi.fn();
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });

    const { result } = renderHook(() => useMyLocation(false));

    expect(result.current.status).toBe('idle');
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });
});
