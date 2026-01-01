import { useCallback, useEffect, useState } from 'react';
import type { GameMode } from '../types';

const GEMS_KEY = 'ColorSwipe_Gems';
export const CURRENCY_EARNED_EVENT = 'ColorSwipe_CurrencyEarned';
const LAST_EARNED_KEY = 'ColorSwipe_LastEarned';
const LAST_EARNED_META_KEY = 'ColorSwipe_LastEarnedMeta';

const MULTIPLIER: Record<GameMode, number> = {
  NORMAL: 1,
  HARD: 2,
  INSANE: 3
};

export function computeGems(score: number, mode: GameMode): number {
  if (!Number.isFinite(score) || score <= 0) return 0;
  // 1 gem per swipe (1:1 ratio)
  const base = score;
  const total = Math.floor(base * MULTIPLIER[mode]);
  return total;
}

export function useCurrency() {
  const [gems, setGems] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(GEMS_KEY);
      const val = raw ? parseInt(raw) : 0;
      return Number.isFinite(val) ? val : 0;
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(GEMS_KEY, gems.toString());
    } catch {
      // ignore storage errors
    }
  }, [gems]);

  const addGemsForScore = useCallback((score: number, mode: GameMode) => {
    const earned = computeGems(score, mode);
    const multiplier = MULTIPLIER[mode];
    if (earned > 0) {
      const next = gems + earned;
      setGems(next);
      try {
        localStorage.setItem(GEMS_KEY, next.toString());
        localStorage.setItem(LAST_EARNED_KEY, earned.toString());
        const payload = { earned, total: next, score, mode, multiplier, timestamp: Date.now() };
        localStorage.setItem(LAST_EARNED_META_KEY, JSON.stringify(payload));
        window.dispatchEvent(new CustomEvent(CURRENCY_EARNED_EVENT, { detail: payload }));
      } catch {}
    }
    return earned;
  }, [gems]);

  const grantGems = useCallback((amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    const bonus = Math.floor(amount);
    const next = gems + bonus;
    setGems(next);
    try {
      localStorage.setItem(GEMS_KEY, next.toString());
    } catch {}
    return bonus;
  }, [gems]);

  const getMultiplier = useCallback((mode: GameMode) => MULTIPLIER[mode], []);

  const resetGems = useCallback(() => {
    setGems(0);
    try { localStorage.setItem(GEMS_KEY, '0'); } catch {}
  }, []);

  const deductGems = useCallback((amount: number) => {
    if (amount <= 0 || !Number.isFinite(amount)) return false;
    if (gems < amount) return false;
    const newTotal = gems - amount;
    setGems(newTotal);
    try { localStorage.setItem(GEMS_KEY, newTotal.toString()); } catch {}
    return true;
  }, [gems]);

  const getLastEarned = useCallback(() => {
    try {
      const metaRaw = localStorage.getItem(LAST_EARNED_META_KEY);
      return metaRaw ? JSON.parse(metaRaw) : null;
    } catch {
      return null;
    }
  }, []);

  return { gems, addGemsForScore, getMultiplier, resetGems, deductGems, getLastEarned, grantGems };
}
