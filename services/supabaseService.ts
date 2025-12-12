import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_TABLE } from '../constants';
import { ScoreEntry, GameMode } from '../types';

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

export const submitScore = async (username: string, score: number, mode: GameMode): Promise<boolean> => {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({
        username: username.trim().substring(0, 12) || 'Anonymous',
        score: score,
        mode: mode
      })
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to submit score:', error);
    return false;
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