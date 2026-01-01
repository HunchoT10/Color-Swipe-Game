import React, { useEffect, useMemo, useState } from 'react';
import { X, Trophy, Loader2, Medal } from 'lucide-react';
import { fetchLeaderboard } from '../services/supabaseService';
import { ScoreEntry, GameMode } from '../types';
import { BASE_HIGH_SCORE_KEY } from '../constants';

interface LeaderboardProps {
  mode: GameMode;
  onClose: () => void;
}

type TimeFrame = 'WEEKLY' | 'FRIENDS';

const Leaderboard: React.FC<LeaderboardProps> = ({ mode, onClose }) => {
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('WEEKLY');

  const weekLabel = useMemo(() => {
    const now = new Date();
    const target = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const dayNum = target.getUTCDay() || 7;
    target.setUTCDate(target.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(target.getUTCFullYear(),0,1));
    const weekNo = Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
    return `Week ${weekNo.toString().padStart(2,'0')}`;
  }, []);

  useEffect(() => {
    if (timeFrame === 'FRIENDS') return;
    const loadScores = async () => {
      setLoading(true);
      setError(false);
      try {
        const data = await fetchLeaderboard(mode, 'WEEKLY');
        setScores(data);
      } catch (err) {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    loadScores();
  }, [mode, timeFrame]);

  const modeLabel = useMemo(() => {
    switch (mode) {
      case 'HARD':
        return 'Hard Mode';
      case 'INSANE':
        return 'Insane Mode';
      default:
        return 'Normal Mode';
    }
  }, [mode]);

  const userBest = useMemo(() => {
    try {
      const raw = localStorage.getItem(`${BASE_HIGH_SCORE_KEY}${mode}`);
      return raw ? parseInt(raw, 10) : 0;
    } catch {
      return 0;
    }
  }, [mode]);

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-start justify-center p-4 pt-24 md:pt-32">
      <div className="bg-gradient-to-b from-[#14171c] to-[#0c0e12] border border-white/10 rounded-2xl w-full max-w-md max-h-[75vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex flex-col gap-4 bg-[#1a1d23]/50">
          <div className="flex justify-between items-start">
            <div className="flex items-start gap-2">
              <Trophy className="text-yellow-400 mt-0.5" size={18} />
              <div className="flex flex-col leading-none">
                <span className="text-lg font-bold text-white md:text-xl leading-none">{weekLabel}</span>
                <span className="text-xs text-gray-300 md:text-sm leading-tight">{modeLabel}</span>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <X size={24} />
            </button>
          </div>

          {/* Toggle Switch */}
          <div className="flex p-1 bg-black/40 rounded-lg">
            <button
              onClick={() => setTimeFrame('WEEKLY')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold transition-all ${
                timeFrame === 'WEEKLY' 
                  ? 'bg-white/10 text-white shadow-sm' 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              THIS WEEK
            </button>
            <button
              onClick={() => setTimeFrame('FRIENDS')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold transition-all ${
                timeFrame === 'FRIENDS' 
                  ? 'bg-white/10 text-white shadow-sm' 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              FRIENDS
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {timeFrame === 'FRIENDS' ? (
            <div className="text-center py-12 text-gray-500 italic">Friends coming soon.</div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Loader2 className="animate-spin mb-2" size={32} />
              <p>Loading {timeFrame === 'WEEKLY' ? "weekly" : "all-time"} scores...</p>
            </div>
          ) : error ? (
            <div className="text-center py-10 text-red-400">
              Failed to load leaderboard.
            </div>
          ) : scores.length === 0 ? (
            <div className="text-center py-10 text-gray-500 italic">
              No scores yet {timeFrame === 'WEEKLY' ? "this week" : ""}. Be the first!
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-gray-500 text-xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="pb-3 text-left pl-2">#</th>
                  <th className="pb-3 text-left">Player</th>
                  <th className="pb-3 text-right pr-2">Score</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                {scores.map((entry, index) => {
                  const rank = index + 1;
                  const medal = rank <=3 ? ['#f8d448','#cfd4d8','#f59e0b'][rank-1] : null;

                  return (
                    <tr key={index} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-3 pl-2 font-bold w-12">
                        {medal ? (
                          <Medal size={18} style={{ color: medal }} />
                        ) : (
                          <span className="text-gray-400">{rank}</span>
                        )}
                      </td>
                      <td className="py-3 font-medium truncate max-w-[150px]">{entry.username}</td>
                      <td className="py-3 pr-2 text-right font-mono text-game-green font-bold">{entry.score}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer: user best context */}
        <div className="p-3 border-t border-white/10 bg-[#1a1d23]/30 text-center text-xs text-gray-300">
          <div className="font-bold text-white">Your Best: {userBest}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wide mt-1">Top 100 Global • Weekly</div>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;