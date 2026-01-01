import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_TABLE } from '../constants';
import { ScoreEntry, GameMode } from '../types';

const PENDING_SCORES_KEY = 'ColorSwipe_PendingScores';
const PROFILES_TABLE = 'profiles';
const SHOP_CACHE_KEY = 'cached_shop';
const SHOP_TABLE = 'shop_items';

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url?: string;
  type: 'power_up' | 'skin' | 'consumable' | 'emoji_skin' | 'theme' | 'save_me';
  active: boolean;
  slug?: string;
  updated_at?: string;
}

interface PendingScore {
  username: string;
  score: number;
  mode: GameMode;
  timestamp: number;
}

export const fetchLeaderboard = async (mode: GameMode, timeframe: 'WEEKLY' | 'ALL_TIME'): Promise<ScoreEntry[]> => {
  try {
    let query = `order=score.desc&mode=eq.${mode}&limit=100`;

    if (timeframe === 'WEEKLY') {
      const now = new Date();
      const day = now.getUTCDay() || 7; // Sunday is 0, treat as 7
      const monday = new Date(now);
      monday.setUTCHours(0, 0, 0, 0);
      monday.setUTCDate(now.getUTCDate() - day + 1);
      
      const isoDate = monday.toISOString();
      query += `&created_at=gte.${isoDate}`;
    }

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?${query}`,
      {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }

    const data = await response.json();
    return data as ScoreEntry[];
  } catch (error) {
    console.error('Failed to fetch leaderboard:', error);
    return [];
  }
};

const savePendingScore = (scoreData: PendingScore) => {
  try {
    const pendingRaw = localStorage.getItem(PENDING_SCORES_KEY);
    const pending: PendingScore[] = pendingRaw ? JSON.parse(pendingRaw) : [];
    pending.push(scoreData);
    localStorage.setItem(PENDING_SCORES_KEY, JSON.stringify(pending));
  } catch (e) {
    console.error('Failed to save pending score locally:', e);
  }
};

export const submitScore = async (username: string, score: number, mode: GameMode): Promise<boolean> => {
  const scoreData = {
    username: username.trim().substring(0, 12) || 'Anonymous',
    score: score,
    mode: mode
  };

  // Helper to save offline
  const handleOffline = () => {
    savePendingScore({ ...scoreData, timestamp: Date.now() });
    return false;
  };

  if (!navigator.onLine) {
    return handleOffline();
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify(scoreData)
    });

    if (!response.ok) {
      throw new Error('Response not OK');
    }

    return true;
  } catch (error) {
    console.error('Failed to submit score, saving offline:', error);
    return handleOffline();
  }
};

export const syncOfflineScores = async () => {
  if (!navigator.onLine) return;

  const pendingRaw = localStorage.getItem(PENDING_SCORES_KEY);
  if (!pendingRaw) return;

  let pending: PendingScore[] = [];
  try {
    pending = JSON.parse(pendingRaw);
  } catch (e) {
    return;
  }

  if (pending.length === 0) return;

  const remaining: PendingScore[] = [];

  for (const item of pending) {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        },
        body: JSON.stringify({
          username: item.username,
          score: item.score,
          mode: item.mode
        })
      });

      // If strict success (200-299), we consider it synced.
      if (!response.ok) {
        remaining.push(item);
      }
    } catch (e) {
      remaining.push(item);
    }
  }

  if (remaining.length > 0) {
    localStorage.setItem(PENDING_SCORES_KEY, JSON.stringify(remaining));
  } else {
    localStorage.removeItem(PENDING_SCORES_KEY);
  }
};

export const checkUsernameAvailability = async (username: string): Promise<boolean> => {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?username=eq.${encodeURIComponent(username)}&select=username`,
      {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    if (!response.ok) return false;
    
    const data = await response.json();
    return Array.isArray(data) && data.length > 0;
  } catch (error) {
    console.error('Error checking username:', error);
    return false;
  }
};

export const updatePlayerNameHistory = async (oldName: string, newName: string): Promise<boolean> => {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?username=eq.${encodeURIComponent(oldName)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ username: newName })
      }
    );
    return response.ok;
  } catch (error) {
    console.error('Error updating history:', error);
    return false;
  }
};

// Profile/Inventory Management
export const syncProfileInventory = async (username: string, saveMeCount: number): Promise<boolean> => {
  if (!navigator.onLine) return false;
  
  try {
    // Upsert profile data
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${PROFILES_TABLE}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({ 
          username,
          save_me_count: saveMeCount,
          updated_at: new Date().toISOString()
        })
      }
    );
    return response.ok;
  } catch (error) {
    console.error('Error syncing profile inventory:', error);
    return false;
  }
};

export const fetchProfileInventory = async (username: string): Promise<{ saveMeCount: number; ownedItems: string[]; equippedSkinId: string | null } | null> => {
  if (!navigator.onLine) return null;
  
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${PROFILES_TABLE}?username=eq.${encodeURIComponent(username)}&select=save_me_count,owned_items,equipped_skin_id`,
      {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    if (!response.ok) return null;
    
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      const owned = Array.isArray(data[0].owned_items) ? data[0].owned_items.filter((x: any) => typeof x === 'string') : [];
      const equipped = data[0].equipped_skin_id || null;
      return { saveMeCount: data[0].save_me_count || 0, ownedItems: owned, equippedSkinId: equipped };
    }
    return null;
  } catch (error) {
    console.error('Error fetching profile inventory:', error);
    return null;
  }
};
// Generic profile sync for cosmetics/skins and inventory
export const syncProfileData = async (
  username: string,
  data: { save_me_count?: number; owned_items?: string[]; equipped_skin_id?: string | null }
): Promise<boolean> => {
  if (!navigator.onLine) return false;

  try {
    const payload: any = { username, updated_at: new Date().toISOString() };
    if (typeof data.save_me_count === 'number') payload.save_me_count = data.save_me_count;
    if (Array.isArray(data.owned_items)) payload.owned_items = data.owned_items;
    if (data.equipped_skin_id !== undefined) payload.equipped_skin_id = data.equipped_skin_id;

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${PROFILES_TABLE}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(payload)
      }
    );
    return response.ok;
  } catch (error) {
    console.error('Error syncing profile data:', error);
    return false;
  }
};
// Dynamic Shop Items
export const fetchShopItems = async (): Promise<ShopItem[]> => {
  try {
    if (!navigator.onLine) {
      const cached = localStorage.getItem(SHOP_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    }

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${SHOP_TABLE}?is_active.eq.true&order=created_at.desc`,
      {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch shop items');
    }

    const raw = await response.json();
    const debugLog = `[${new Date().toISOString()}] Raw response: ${JSON.stringify(raw)}`;
    console.log(debugLog);
    try {
      localStorage.setItem('shop_debug_log', debugLog);
    } catch {}
    
    const normalized: ShopItem[] = (Array.isArray(raw) ? raw : []).map((item: any) => {
      const itemId = item.id?.toString() || item.slug || crypto.randomUUID();
      return {
        id: itemId,
        slug: item.slug,
        name: item.name,
        description: item.description,
        price: Number(item.price) || 0,
        image_url: item.image_url || item.image || undefined,
        type: item.type || item.item_type || 'consumable',
          active: (item.active ?? item.is_active ?? true) === true,
          updated_at: item.updated_at || item.created_at
      };
    });

    const normLog = `[${new Date().toISOString()}] Normalized: ${JSON.stringify(normalized)}`;
    console.log(normLog);
    try {
      localStorage.setItem('shop_debug_normalized', normLog);
    } catch {}

    localStorage.setItem(SHOP_CACHE_KEY, JSON.stringify(normalized));
    return normalized;
  } catch (error) {
    console.error('Failed to fetch shop items:', error);
    const cached = localStorage.getItem(SHOP_CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  }
};