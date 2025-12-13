import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Play, 
  Trophy, 
  Info, 
  BarChart2, 
  Pencil,
  Target,
  Flame,
  Zap,
  WifiOff
} from 'lucide-react';

import { 
  COLORS, 
  COLOR_TO_DIRECTION, 
  CSS_COLORS, 
  INITIAL_TIME_LIMIT_NORMAL, 
  INITIAL_TIME_LIMIT_HARD, 
  INITIAL_TIME_LIMIT_INSANE,
  MIN_TIME_LIMIT,
  SWIPE_THRESHOLD,
  BASE_HIGH_SCORE_KEY,
  USERNAME_KEY
} from './constants';

import { GameMode, Challenge, Direction } from './types';
import { 
  submitScore, 
  checkUsernameAvailability, 
  updatePlayerNameHistory,
  syncOfflineScores
} from './services/supabaseService';
import Leaderboard from './components/Leaderboard';
import Instructions from './components/Instructions';
import EditNameModal from './components/EditNameModal';

// Helper type for tracking active requirements
type SwipeRequirement = {
  direction: Direction;
  id: string;
};

export default function App() {
  // --- State ---
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameOverReason, setGameOverReason] = useState('');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameMode, setGameMode] = useState<GameMode>('NORMAL');
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [blockAnimationKey, setBlockAnimationKey] = useState(0); // to trigger CSS animation reflow
  const [username, setUsername] = useState('Anonymous');
  const [timerBarColor, setTimerBarColor] = useState<string>('#fff');
  
  // For INSANE mode visuals (to hide specific completed blocks)
  const [completedBlockIds, setCompletedBlockIds] = useState<string[]>([]);
  
  // Network State
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Modals
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showEditName, setShowEditName] = useState(false);

  // Refs for Game Loop & Logic
  const timerRef = useRef<number>(0);
  const endTimeRef = useRef<number>(0);
  const timeLimitRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  
  // Critical: Use Ref for swipe validation to avoid closure staleness during rapid inputs
  // Stores objects now to track specific IDs
  const requiredSwipesRef = useRef<SwipeRequirement[]>([]);

  // --- Initialization ---
  useEffect(() => {
    // Simulate loading asset/init
    const timer = setTimeout(() => {
      setLoading(false);
    }, 800);
    
    // Load initial high score and username
    loadHighScore('NORMAL');
    loadUsername();
    
    // Try to sync any offline scores immediately on boot
    syncOfflineScores();

    // Network listeners
    const handleStatusChange = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      if (online) {
        syncOfflineScores();
      }
    };
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  // Sync when opening leaderboard
  useEffect(() => {
    if (showLeaderboard && isOnline) {
      syncOfflineScores();
    }
  }, [showLeaderboard, isOnline]);

  const loadHighScore = (mode: GameMode) => {
    const saved = localStorage.getItem(`${BASE_HIGH_SCORE_KEY}${mode}`);
    setHighScore(saved ? parseInt(saved) : 0);
  };

  const loadUsername = () => {
    const stored = localStorage.getItem(USERNAME_KEY);
    if (stored) setUsername(stored);
  };

  const changeMode = (mode: GameMode) => {
    setGameMode(mode);
    loadHighScore(mode);
  };

  const handleSaveName = async (newName: string) => {
    // Check if taken
    if (isOnline) {
      const isTaken = await checkUsernameAvailability(newName);
      if (isTaken) return false;

      // Update history
      if (username && username !== 'Anonymous') {
        await updatePlayerNameHistory(username, newName);
      }
    }

    localStorage.setItem(USERNAME_KEY, newName);
    setUsername(newName);
    return true;
  };

  // --- Game Mechanics ---

  const generateChallenge = useCallback(() => {
    // Reset completed blocks for the new challenge
    setCompletedBlockIds([]);

    let nextSwipes: SwipeRequirement[] = [];
    let nextChallenge: Challenge;
    let nextTimerColor = '#fff';

    if (gameMode === 'INSANE') {
      // Insane Mode: Generate 2 items
      const seq = [1, 2].map((_, i) => {
        const c = COLORS[Math.floor(Math.random() * COLORS.length)];
        return {
          color: c,
          direction: COLOR_TO_DIRECTION[c],
          id: `insane-${Date.now()}-${i}`
        };
      });

      nextChallenge = {
        blockColor: seq[0].color, // Default for type safety
        textColor: seq[0].color,
        requiredDirection: seq[0].direction,
        sequence: seq
      };
      
      // Store ID and Direction
      nextSwipes = seq.map(s => ({ direction: s.direction, id: s.id }));
      
      // Random timer color for Insane
      const randomColorIdx = Math.floor(Math.random() * COLORS.length);
      nextTimerColor = CSS_COLORS[COLORS[randomColorIdx]];
    } 
    else {
      // Normal / Hard
      const blockColorIdx = Math.floor(Math.random() * COLORS.length);
      const blockColor = COLORS[blockColorIdx];
      
      let textColor = blockColor;
      nextTimerColor = CSS_COLORS[blockColor];

      if (gameMode === 'HARD') {
        // 60% chance of distraction text
        if (Math.random() < 0.6) {
          let conflictingColor;
          do {
            conflictingColor = COLORS[Math.floor(Math.random() * COLORS.length)];
          } while (conflictingColor === blockColor);
          textColor = conflictingColor;
        }
        // Random timer color for Hard
        const randomColorIdx = Math.floor(Math.random() * COLORS.length);
        nextTimerColor = CSS_COLORS[COLORS[randomColorIdx]];
      }

      nextChallenge = {
        blockColor,
        textColor,
        requiredDirection: COLOR_TO_DIRECTION[blockColor]
      };
      
      // Use a dummy ID for single block modes
      nextSwipes = [{ direction: COLOR_TO_DIRECTION[blockColor], id: 'single' }];
    }

    // Update State & Refs
    setChallenge(nextChallenge);
    setTimerBarColor(nextTimerColor);
    
    requiredSwipesRef.current = nextSwipes;

    setBlockAnimationKey(prev => prev + 1); // Trigger pop animation
  }, [gameMode]);

  const endGame = useCallback((reason: string) => {
    setIsPlaying(false);
    setIsGameOver(true);
    setGameOverReason(reason);
    
    // High Score Logic
    let isNewHigh = false;
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem(`${BASE_HIGH_SCORE_KEY}${gameMode}`, score.toString());
      isNewHigh = true;
    }
    setIsNewHighScore(isNewHigh);

    // Leaderboard Submission
    // Modified: removed isOnline check so we attempt submit (and save offline if needed)
    if (score > 0) {
      let finalName = username;
      if (finalName === 'Anonymous') {
        const inputName = window.prompt("New Score! Enter your name (max 12 chars):");
        if (inputName) {
            finalName = inputName.trim().substring(0, 12);
            localStorage.setItem(USERNAME_KEY, finalName);
            setUsername(finalName);
        }
      }
      submitScore(finalName || 'Anonymous', score, gameMode);
    }
  }, [score, highScore, gameMode, username]);

  // --- Game Loop ---
  const gameLoop = useCallback(() => {
    const now = Date.now();
    const remaining = Math.max(0, endTimeRef.current - now);
    
    setTimeLeft(remaining);

    if (remaining <= 0) {
      endGame("TIME'S UP!");
    } else {
      timerRef.current = requestAnimationFrame(gameLoop);
    }
  }, [endGame]);

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = requestAnimationFrame(gameLoop);
    }
    return () => {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
    };
  }, [isPlaying, gameLoop]);

  const startGame = () => {
    setScore(0);
    setIsGameOver(false);
    setIsNewHighScore(false);
    setIsPlaying(true);
    setGameOverReason('');
    setCompletedBlockIds([]);
    
    if (gameMode === 'INSANE') {
      timeLimitRef.current = INITIAL_TIME_LIMIT_INSANE;
    } else if (gameMode === 'HARD') {
      timeLimitRef.current = INITIAL_TIME_LIMIT_HARD;
    } else {
      timeLimitRef.current = INITIAL_TIME_LIMIT_NORMAL;
    }
    
    generateChallenge();
    
    // Start Timer
    endTimeRef.current = Date.now() + timeLimitRef.current;
  };

  const handleInput = useCallback((direction: Direction) => {
    if (!isPlaying) return;

    const currentRequired = requiredSwipesRef.current;
    if (currentRequired.length === 0) return;

    // Search for a matching direction in the remaining requirements
    // This allows picking ANY of the displayed blocks in Insane mode
    const matchIndex = currentRequired.findIndex(req => req.direction === direction);

    if (matchIndex !== -1) {
      // Found a match!
      const matchedItem = currentRequired[matchIndex];
      
      // Remove the matched item from requirements
      const newRequired = [...currentRequired];
      newRequired.splice(matchIndex, 1);
      requiredSwipesRef.current = newRequired;
      
      // Update UI to hide this specific block
      setCompletedBlockIds(prev => [...prev, matchedItem.id]);

      // Check if all swipes for this challenge are complete
      if (newRequired.length === 0) {
        // Correct Full Sequence!
        const newScore = score + 1;
        setScore(newScore);
        
        // Difficulty Scaling
        let timeReduction = 50;
        let minTime = 500;

        if (gameMode === 'HARD') {
          timeReduction = 75;
          minTime = 300;
        } else if (gameMode === 'INSANE') {
          timeReduction = 40; // Smaller reduction but starts much faster
          minTime = 400; // Floor is slightly higher due to 2 swipes needed
        }
        
        if (newScore > 0 && newScore % 5 === 0 && timeLimitRef.current > minTime) {
          timeLimitRef.current -= timeReduction;
        }

        // Reset Timer for next round
        endTimeRef.current = Date.now() + timeLimitRef.current;
        
        generateChallenge();
      }
    } else {
      endGame("WRONG SWIPE!");
    }
  }, [isPlaying, score, gameMode, endGame, generateChallenge]);

  // --- Input Listeners ---

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying) return;
      
      let dir: Direction | null = null;
      switch(e.key) {
        case 'ArrowUp': case 'w': case 'W': dir = 'UP'; break;
        case 'ArrowDown': case 's': case 'S': dir = 'DOWN'; break;
        case 'ArrowLeft': case 'a': case 'A': dir = 'LEFT'; break;
        case 'ArrowRight': case 'd': case 'D': dir = 'RIGHT'; break;
      }
      
      if (dir) handleInput(dir);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, handleInput]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.changedTouches[0].screenX,
      y: e.changedTouches[0].screenY
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || !isPlaying) return;

    const endX = e.changedTouches[0].screenX;
    const endY = e.changedTouches[0].screenY;
    
    const deltaX = endX - touchStartRef.current.x;
    const deltaY = endY - touchStartRef.current.y;

    if (Math.abs(deltaX) < SWIPE_THRESHOLD && Math.abs(deltaY) < SWIPE_THRESHOLD) return;

    let dir: Direction;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      dir = deltaX > 0 ? 'RIGHT' : 'LEFT';
    } else {
      dir = deltaY > 0 ? 'DOWN' : 'UP';
    }
    
    handleInput(dir);
  };

  // --- Render Helpers ---

  // Calculate timer progress percentage
  const timerProgress = timeLimitRef.current > 0 
    ? Math.min(100, Math.max(0, (timeLeft / timeLimitRef.current) * 100)) 
    : 0;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#0b0b0d] flex flex-col items-center justify-center z-50">
        <div className="w-12 h-12 border-4 border-[#333] border-t-game-green rounded-full animate-spin mb-4"></div>
        <h1 className="text-2xl font-bold text-game-green tracking-widest">COLOR SWIPE</h1>
      </div>
    );
  }

  return (
    <div 
      className="relative w-full h-dvh overflow-hidden flex flex-col bg-game-bg text-white bg-[radial-gradient(circle_at_20%_20%,_rgba(0,255,136,0.08),_transparent_30%),_radial-gradient(circle_at_80%_10%,_rgba(0,153,255,0.08),_transparent_25%)]"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* --- Timer Bar (Top) --- */}
      {isPlaying && (
        <div className="absolute top-0 left-0 w-full h-2 z-50 bg-gray-900/50">
           <div 
              className="h-full transition-colors duration-200"
              style={{ 
                width: `${timerProgress}%`, 
                backgroundColor: timerBarColor,
                boxShadow: `0 0 10px ${timerBarColor}`
              }}
           />
        </div>
      )}

      {/* --- Status Bar --- */}
      <div className="flex justify-between items-center px-8 py-8 font-mono font-bold text-lg select-none z-20">
        <div className="flex flex-col items-start">
          <span className="text-gray-400 text-xs tracking-wider">SCORE</span>
          <span className="text-3xl">{score}</span>
        </div>
        
        <div className="flex flex-col items-end">
          <span className="text-gray-400 text-xs tracking-wider">BEST</span>
          <span className="text-3xl text-game-green">{highScore}</span>
        </div>
      </div>

      {/* --- Game Area --- */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 pb-20">
        {challenge && (
          <>
            {/* INSANE MODE RENDER */}
            {gameMode === 'INSANE' && challenge.sequence ? (
              <div key={blockAnimationKey} className="flex gap-4 items-center">
                 {challenge.sequence.map((item) => {
                   const isCompleted = completedBlockIds.includes(item.id);
                   return (
                     <div 
                        key={item.id}
                        className={`w-32 h-32 rounded-3xl border-4 border-white shadow-[0_0_30px_rgba(0,0,0,0.5)] transition-all duration-150
                          ${isCompleted ? 'opacity-0 scale-50' : 'opacity-100 scale-100 animate-pop'}
                        `}
                        style={{ backgroundColor: CSS_COLORS[item.color] }}
                     />
                   );
                 })}
              </div>
            ) : (
              /* NORMAL / HARD MODE RENDER */
              <>
                <div 
                  className="text-4xl font-extrabold mb-12 tracking-wider transition-colors duration-200 select-none"
                  style={{ 
                    color: gameMode === 'HARD' 
                      ? CSS_COLORS[challenge.textColor] 
                      : 'white' 
                  }}
                >
                  {challenge.textColor}
                </div>

                <div 
                  key={blockAnimationKey} 
                  className="w-40 h-40 rounded-3xl border-4 border-white shadow-[0_0_30px_rgba(0,0,0,0.5)] animate-pop transition-colors duration-150 ease-linear"
                  style={{ backgroundColor: CSS_COLORS[challenge.blockColor] }}
                ></div>
              </>
            )}
            
            {/* Visual Guide for Desktop */}
            <div className="absolute bottom-8 text-gray-500 text-sm hidden md:block opacity-50 select-none">
              Use Arrow Keys or WASD
            </div>
          </>
        )}
      </div>

      {/* --- Overlay (Menu / Game Over) --- */}
      {(!isPlaying) && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-gradient-to-b from-[#14171c] to-[#0c0e12] border border-white/10 rounded-[2rem] p-8 shadow-2xl flex flex-col items-center">
            
            {/* Title */}
            <div className="flex flex-col items-center mb-6">
              <span className="text-3xl font-extrabold text-[#1fd4a5] tracking-wider">COLOR</span>
              <span className="text-3xl font-extrabold text-[#2a8bff] tracking-wider">SWIPE</span>
            </div>

            {/* Game Over Message */}
            {isGameOver && (
              <div className="mb-6 text-center animate-pulse-fast">
                <h2 className="text-xl font-bold text-gray-200">{gameOverReason}</h2>
                <div className="text-4xl font-mono font-bold mt-2 text-white">
                  {score}
                  {isNewHighScore && <span className="text-xs ml-2 text-yellow-400 align-top">NEW HIGH!</span>}
                </div>
              </div>
            )}

            {/* Mode Select */}
            <div className="grid grid-cols-3 gap-2 w-full mb-6">
              <button 
                onClick={() => changeMode('NORMAL')}
                className={`p-2 rounded-xl border flex flex-col items-center justify-center transition-all ${
                  gameMode === 'NORMAL' 
                    ? 'bg-game-green/10 border-game-green shadow-[0_0_15px_rgba(0,255,136,0.2)]' 
                    : 'bg-[#171a1f] border-white/5 hover:border-white/20'
                }`}
              >
                <Target size={16} className={`mb-1 ${gameMode === 'NORMAL' ? 'text-game-green' : 'text-gray-500'}`} />
                <span className={`font-bold text-xs ${gameMode === 'NORMAL' ? 'text-game-green' : 'text-gray-400'}`}>NORMAL</span>
              </button>
              
              <button 
                onClick={() => changeMode('HARD')}
                className={`p-2 rounded-xl border flex flex-col items-center justify-center transition-all ${
                  gameMode === 'HARD' 
                    ? 'bg-game-red/10 border-game-red shadow-[0_0_15px_rgba(255,95,82,0.2)]' 
                    : 'bg-[#171a1f] border-white/5 hover:border-white/20'
                }`}
              >
                <Flame size={16} className={`mb-1 ${gameMode === 'HARD' ? 'text-game-red' : 'text-gray-500'}`} />
                <span className={`font-bold text-xs ${gameMode === 'HARD' ? 'text-game-red' : 'text-gray-400'}`}>HARD</span>
              </button>

              <button 
                onClick={() => changeMode('INSANE')}
                className={`p-2 rounded-xl border flex flex-col items-center justify-center transition-all ${
                  gameMode === 'INSANE' 
                    ? 'bg-purple-500/10 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.2)]' 
                    : 'bg-[#171a1f] border-white/5 hover:border-white/20'
                }`}
              >
                <Zap size={16} className={`mb-1 ${gameMode === 'INSANE' ? 'text-purple-500' : 'text-gray-500'}`} />
                <span className={`font-bold text-xs ${gameMode === 'INSANE' ? 'text-purple-500' : 'text-gray-400'}`}>INSANE</span>
              </button>
            </div>
            
            <div className="w-full text-center mb-4 min-h-[1.5rem]">
              {gameMode === 'NORMAL' && <span className="text-xs text-gray-500">Match Color • Relaxed Speed</span>}
              {gameMode === 'HARD' && <span className="text-xs text-gray-500">Distractions • Faster Speed</span>}
              {gameMode === 'INSANE' && <span className="text-xs text-purple-400 font-bold animate-pulse">Double Swipe • Extreme Speed</span>}
            </div>

            {/* Start Button */}
            <button 
              onClick={startGame}
              className="w-full bg-gradient-to-b from-white to-gray-200 text-black font-extrabold py-4 rounded-xl shadow-lg hover:translate-y-[1px] hover:shadow-md active:translate-y-[2px] transition-all flex items-center justify-center gap-2 mb-6 text-lg"
            >
              <Play fill="black" size={20} />
              {isGameOver ? 'TRY AGAIN' : 'START GAME'}
            </button>

            {/* Footer Buttons */}
            <div className="grid grid-cols-2 gap-3 w-full">
               {/* High Score Card */}
               <div className="bg-[#1a1d23] border border-white/5 rounded-xl p-3 flex items-center gap-3">
                <Trophy className="text-yellow-500" size={18} />
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase text-gray-500 font-bold">High Score</span>
                  <span className="font-mono font-bold text-white">{highScore}</span>
                </div>
              </div>

              {/* Instructions Btn */}
              <button 
                onClick={() => setShowInstructions(true)}
                className="bg-[#1a1d23] border border-white/5 rounded-xl p-3 flex items-center gap-3 hover:bg-[#252830] transition-colors text-left"
              >
                <Info className="text-blue-400" size={18} />
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase text-gray-500 font-bold">Guide</span>
                  <span className="text-xs font-bold text-white">How to Play</span>
                </div>
              </button>
            </div>
            
            <button 
              onClick={() => isOnline && setShowLeaderboard(true)}
              disabled={!isOnline}
              className={`w-full mt-3 bg-[#1a1d23] border border-white/5 rounded-xl p-3 flex items-center gap-3 transition-colors ${
                !isOnline ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#252830]'
              }`}
            >
               {isOnline ? (
                 <BarChart2 className="text-purple-400" size={18} />
               ) : (
                 <WifiOff className="text-gray-500" size={18} />
               )}
               <div className="flex flex-col items-start">
                  <span className="text-[10px] uppercase text-gray-500 font-bold">Rankings</span>
                  <span className="text-xs font-bold text-white">
                    {isOnline ? 'Global Leaderboard' : 'Offline Mode'}
                  </span>
               </div>
            </button>
            
            {/* Edit Name Button (Bottom Right) */}
            <div className="w-full flex justify-end mt-2">
              <button 
                onClick={() => setShowEditName(true)}
                className="group flex items-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
              >
                <div className="text-right flex flex-col items-end">
                  <span className="text-[10px] uppercase font-bold text-gray-600 group-hover:text-gray-500">Player</span>
                  <span className="text-xs font-bold">{username}</span>
                </div>
                <Pencil size={14} className="text-gray-600 group-hover:text-white transition-colors" />
              </button>
            </div>

          </div>
        </div>
      )}

      {/* --- Modals --- */}
      {showInstructions && <Instructions onClose={() => setShowInstructions(false)} />}
      {showLeaderboard && <Leaderboard mode={gameMode} onClose={() => setShowLeaderboard(false)} />}
      {showEditName && <EditNameModal currentName={username} onClose={() => setShowEditName(false)} onSave={handleSaveName} />}
    </div>
  );
}