import { useCallback, useEffect, useRef, useState } from 'react';

// Local storage keys
const SAVE_ME_COUNT_KEY = 'ColorSwipe_SaveMeCount';
const OWNED_ITEMS_KEY = 'ColorSwipe_OwnedItems';
const EQUIPPED_SKIN_KEY = 'ColorSwipe_EquippedSkinId';
const SAVE_ME_COST = 500;

export interface PurchasableItem {
  id: string;
  price: number;
  type: string; // e.g., 'save_me', 'emoji_skin', 'theme', 'skin', 'power_up', 'consumable'
}

export interface BuyResult {
  ok: boolean;
  message?: string;
  updated?: {
    saveMeCount?: number;
    ownedItems?: string[];
    equippedSkinId?: string | null;
  };
}

export function useInventory() {
  const [saveMeCount, setSaveMeCount] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(SAVE_ME_COUNT_KEY);
      const val = raw ? parseInt(raw) : 0;
      return Number.isFinite(val) && val >= 0 ? val : 0;
    } catch {
      return 0;
    }
  });

  const [ownedItems, setOwnedItems] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(OWNED_ITEMS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  });

  const [equippedSkinId, setEquippedSkinId] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem(EQUIPPED_SKIN_KEY);
      return raw || null;
    } catch {
      return null;
    }
  });

  // One-time first-time grant of 5 Save Mes
  useEffect(() => {
    const GRANT_KEY = 'ColorSwipe_FirstTimeSaveMeGranted_v1';
    try {
      const granted = localStorage.getItem(GRANT_KEY);
      if (!granted) {
        const next = saveMeCount + 5;
        setSaveMeCount(next);
        localStorage.setItem(SAVE_ME_COUNT_KEY, next.toString());
        localStorage.setItem(GRANT_KEY, 'true');
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SAVE_ME_COUNT_KEY, saveMeCount.toString());
    } catch {
      // ignore storage errors
    }
  }, [saveMeCount]);

  useEffect(() => {
    try {
      localStorage.setItem(OWNED_ITEMS_KEY, JSON.stringify(ownedItems));
    } catch {}
  }, [ownedItems]);

  useEffect(() => {
    try {
      if (equippedSkinId) localStorage.setItem(EQUIPPED_SKIN_KEY, equippedSkinId);
      else localStorage.removeItem(EQUIPPED_SKIN_KEY);
    } catch {}
  }, [equippedSkinId]);

  const buySaveMe = useCallback((currentGems: number, deductGemsFn: (amount: number) => boolean): boolean => {
    if (currentGems < SAVE_ME_COST) {
      return false; // Not enough gems
    }
    
    const success = deductGemsFn(SAVE_ME_COST);
    if (success) {
      const newCount = saveMeCount + 1;
      setSaveMeCount(newCount);
      try { localStorage.setItem(SAVE_ME_COUNT_KEY, newCount.toString()); } catch {}
      return true;
    }
    return false;
  }, [saveMeCount]);

  const useSaveMe = useCallback((): boolean => {
    if (saveMeCount <= 0) return false;
    const newCount = saveMeCount - 1;
    setSaveMeCount(newCount);
    try { localStorage.setItem(SAVE_ME_COUNT_KEY, newCount.toString()); } catch {}
    return true;
  }, [saveMeCount]);

  const getSaveMeCost = useCallback(() => SAVE_ME_COST, []);

  const isCosmetic = (type: string) => type === 'emoji_skin' || type === 'theme' || type === 'skin';

  const buyShopItem = useCallback((item: PurchasableItem, currentGems: number, deductGemsFn: (amount: number) => boolean): BuyResult => {
    if (!item || !Number.isFinite(item.price) || item.price <= 0) {
      return { ok: false, message: 'Invalid item' };
    }

    // If already owned (cosmetics), do not buy again
    if (isCosmetic(item.type) && ownedItems.includes(item.id)) {
      return { ok: false, message: 'Already owned' };
    }

    if (currentGems < item.price) {
      return { ok: false, message: 'Not enough gems' };
    }

    const deducted = deductGemsFn(item.price);
    if (!deducted) {
      return { ok: false, message: 'Payment failed' };
    }

    if (item.type === 'save_me') {
      const newCount = saveMeCount + 1;
      setSaveMeCount(newCount);
      try { localStorage.setItem(SAVE_ME_COUNT_KEY, newCount.toString()); } catch {}
      return { ok: true, message: 'Saved!', updated: { saveMeCount: newCount } };
    }

    if (isCosmetic(item.type)) {
      const nextOwned = ownedItems.includes(item.id) ? ownedItems : [...ownedItems, item.id];
      setOwnedItems(nextOwned);
      try { localStorage.setItem(OWNED_ITEMS_KEY, JSON.stringify(nextOwned)); } catch {}
      return { ok: true, message: 'Unlocked!', updated: { ownedItems: nextOwned } };
    }

    // Other item categories can be handled here in future
    return { ok: true, message: 'Purchased!' };
  }, [ownedItems, saveMeCount]);

  const equipSkin = useCallback((skinId: string) => {
    const finalId = skinId === '' ? null : skinId;
    setEquippedSkinId(finalId);
    try {
      if (finalId) localStorage.setItem(EQUIPPED_SKIN_KEY, finalId);
      else localStorage.removeItem(EQUIPPED_SKIN_KEY);
    } catch {}
  }, []);

  const hydrateInventory = useCallback((data: { ownedItems?: string[]; equippedSkinId?: string | null; saveMeCount?: number }) => {
    if (Array.isArray(data.ownedItems)) {
      const cleaned = data.ownedItems.filter((x) => typeof x === 'string');
      setOwnedItems(cleaned);
      try { localStorage.setItem(OWNED_ITEMS_KEY, JSON.stringify(cleaned)); } catch {}
    }
    if (data.equippedSkinId !== undefined) {
      setEquippedSkinId(data.equippedSkinId || null);
      try {
        if (data.equippedSkinId) localStorage.setItem(EQUIPPED_SKIN_KEY, data.equippedSkinId);
        else localStorage.removeItem(EQUIPPED_SKIN_KEY);
      } catch {}
    }
    if (typeof data.saveMeCount === 'number' && Number.isFinite(data.saveMeCount)) {
      const next = Math.max(0, Math.floor(data.saveMeCount));
      setSaveMeCount(next);
      try { localStorage.setItem(SAVE_ME_COUNT_KEY, next.toString()); } catch {}
    }
  }, []);

  return { 
    saveMeCount, 
    buySaveMe, 
    useSaveMe, 
    getSaveMeCost,
    ownedItems,
    equippedSkinId,
    buyShopItem,
    equipSkin,
    hydrateInventory
  };
}
