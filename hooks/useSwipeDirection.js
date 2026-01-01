import { useRef, useCallback } from 'react';
import { SWIPE_THRESHOLD } from '../constants';

export function useSwipeDirection(onDirection, enabled = true) {
  const touchStartRef = useRef(null);

  const onTouchStart = useCallback((e) => {
    if (!enabled) return;
    const touch = e.changedTouches[0];
    touchStartRef.current = { x: touch.screenX, y: touch.screenY };
  }, [enabled]);

  const onTouchEnd = useCallback((e) => {
    if (!enabled || !touchStartRef.current) return;

    const start = touchStartRef.current;
    const touch = e.changedTouches[0];
    const deltaX = touch.screenX - start.x;
    const deltaY = touch.screenY - start.y;

    if (Math.abs(deltaX) < SWIPE_THRESHOLD && Math.abs(deltaY) < SWIPE_THRESHOLD) return;

    let dir;
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
