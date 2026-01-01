import { useEffect } from 'react';
import { CURRENCY_EARNED_EVENT } from './useCurrency';

export interface CurrencyNotifierOptions {
  alertEnabled?: boolean; // show window.alert
  consoleEnabled?: boolean; // log to console
}

export function useCurrencyNotifier(enabled: boolean = true, options: CurrencyNotifierOptions = { alertEnabled: true, consoleEnabled: true }) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: Event) => {
      const anyEvt = e as CustomEvent;
      const payload = anyEvt.detail as { earned: number; total: number; score: number; mode: string; multiplier: number; timestamp: number };
      const msg = `Earned ${payload.earned} gems (mode ${payload.mode} x${payload.multiplier}). Total: ${payload.total}.`;
      if (options.consoleEnabled) console.log('[Currency]', msg, payload);
      if (options.alertEnabled) {
        try { window.alert(msg); } catch {}
      }
    };

    window.addEventListener(CURRENCY_EARNED_EVENT, handler);
    return () => window.removeEventListener(CURRENCY_EARNED_EVENT, handler);
  }, [enabled, options.alertEnabled, options.consoleEnabled]);
}
