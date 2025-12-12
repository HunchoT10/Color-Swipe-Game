import React, { useEffect, useState } from 'react';
import { X, Trophy, Loader2 } from 'lucide-react';
import { fetchLeaderboard } from '../services/supabaseService';
import { ScoreEntry, GameMode } from '../types';

interface LeaderboardProps {
  mode: GameMode;
  onClose: () => void;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ mode, onClose }) => {
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadScores = async () => {
      setLoading(true);
      setError(false);
      try {
        const data = await fetchLeaderboard(mode);
        setScores(data);
      } catch (err) {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    loadScores();
  }, [mode]);

  const getTitle = () => {
    switch(mode) {
      case 'HARD': return 'Hard Leaderboard';
      case 'INSANE': return 'Insane Leaderboard';
      default: return 'Normal Leaderboard';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-b from-[#14171c] to-[#0c0e12] border border-white/10 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex justify-between items-center bg-[#1a1d23]/50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Trophy className="text-yellow-400" size={20} />
            <h3 className="text-xl font-bold text-white">
              {getTitle()}
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Loader2 className="animate-spin mb-2" size={32} />
              <p>Loading scores...</p>
            </div>
          ) : error ? (
            <div className="text-center py-10 text-red-400">
              Failed to load leaderboard.
            </div>
          ) : scores.length === 0 ? (
            <div className="text-center py-10 text-gray-500 italic">
              No scores yet. Be the first!
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
                  let rankColor = 'text-gray-400';
                  if (rank === 1) rankColor = 'text-yellow-400';
                  if (rank === 2) rankColor = 'text-gray-300';
                  if (rank === 3) rankColor = 'text-orange-400';

                  return (
                    <tr key={index} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className={`py-3 pl-2 font-bold ${rankColor} w-10`}>{rank}</td>
                      <td className="py-3 font-medium truncate max-w-[150px]">{entry.username}</td>
                      <td className="py-3 pr-2 text-right font-mono text-game-green font-bold">{entry.score}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;