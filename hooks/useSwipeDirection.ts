import { useRef, useCallback } from 'react';
// React type import intentionally omitted to avoid TS env issues
import type { Direction } from '../types';
import { SWIPE_THRESHOLD } from '../constants';

interface Handlers {
  onTouchStart: (e: any) => void;
  onTouchEnd: (e: any) => void;
}

export function useSwipeDirection(onDirection: (dir: Direction) => void, enabled: boolean = true): Handlers {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback((e: any) => {
    if (!enabled) return;
    const touch = e.changedTouches[0];
    touchStartRef.current = { x: touch.screenX, y: touch.screenY };
  }, [enabled]);

  const onTouchEnd = useCallback((e: any) => {
    if (!enabled || !touchStartRef.current) return;

    const start = touchStartRef.current;
    const touch = e.changedTouches[0];
    const deltaX = touch.screenX - start.x;
    const deltaY = touch.screenY - start.y;

    // Ignore tiny movements
    if (Math.abs(deltaX) < SWIPE_THRESHOLD && Math.abs(deltaY) < SWIPE_THRESHOLD) return;

    let dir: Direction;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      dir = deltaX > 0 ? 'RIGHT' : 'LEFT';
    } else {
      dir = deltaY > 0 ? 'DOWN' : 'UP';
    }

    onDirection(dir);
    touchStartRef.current = null;
  }, [enabled, onDirection]);

  return { onTouchStart, onTouchEnd };
}
