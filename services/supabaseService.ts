import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_TABLE } from '../constants';
import { ScoreEntry, GameMode } from '../types';

const PENDING_SCORES_KEY = 'ColorSwipe_PendingScores';

interface PendingScore {
  username: string;
  score: number;
  mode: GameMode;
  timestamp: number;
}

export const fetchLeaderboard = async (mode: GameMode): Promise<ScoreEntry[]> => {
  try {
    const query = `order=score.desc&mode=eq.${mode}&limit=10`;
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