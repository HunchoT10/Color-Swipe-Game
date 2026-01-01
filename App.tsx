import React, { useState, useEffect, useCallback, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { 
  Play, 
  Trophy, 
  Info, 
  BarChart2, 
  Pencil,
  Target,
  Flame,
  Zap,
  WifiOff,
  ShoppingBag,
  Heart
} from 'lucide-react';

import { 
  COLORS, 
  COLOR_TO_DIRECTION, 
  CSS_COLORS, 
  INITIAL_TIME_LIMIT_NORMAL, 
  INITIAL_TIME_LIMIT_HARD, 
  INITIAL_TIME_LIMIT_INSANE,
  MIN_TIME_LIMIT,
  BASE_HIGH_SCORE_KEY,
  USERNAME_KEY,
  SUPABASE_URL
} from './constants';

import { GameMode, Challenge, Direction } from './types';
import { 
  submitScore, 
  checkUsernameAvailability, 
  updatePlayerNameHistory,
  syncOfflineScores,
  fetchProfileInventory,
  ShopItem, 
  syncProfileData,
  fetchShopItems
} from './services/supabaseService';
import { SkinCacheManager } from './services/skinCacheManager';
import { ImageCacheManager } from './services/imageCacheManager';
import Leaderboard from './components/Leaderboard';
import Instructions from './components/Instructions';
import EditNameModal from './components/EditNameModal';
import Shop from './components/Shop';
import { useSwipeDirection } from './hooks/useSwipeDirection';
import { generateChallenge as genChallenge, SwipeRequirement } from './services/gameLogic';
import { useCurrency } from './hooks/useCurrency';
import { useInventory, PurchasableItem } from './hooks/useInventory';

// Helper type for tracking active requirements
// SwipeRequirement now imported from services/gameLogic

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
  const [lastEarnedGems, setLastEarnedGems] = useState<number>(0);
  const [revivePromptActive, setRevivePromptActive] = useState(false);
  const [reviveTimeLeft, setReviveTimeLeft] = useState(5);
  const [reviving, setReviving] = useState(false);
  const [revivingLabel, setRevivingLabel] = useState('3');
  const [reviveUses, setReviveUses] = useState(0);
  const [exitHintVisible, setExitHintVisible] = useState(false);
  const [failedSkinKeys, setFailedSkinKeys] = useState<Set<string>>(new Set());
  const [skinAssetsReady, setSkinAssetsReady] = useState<boolean>(true); // true by default (no skin equipped)
  const [loadingSkinAssets, setLoadingSkinAssets] = useState<boolean>(false);
  
  // Gem collection animation
  const [showGemFloating, setShowGemFloating] = useState(false);
  
  // For INSANE mode visuals (to hide specific completed blocks)
  const [completedBlockIds, setCompletedBlockIds] = useState<string[]>([]);
  
  // Network State
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Modals
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showEditName, setShowEditName] = useState(false);
  const [showShop, setShowShop] = useState(false);

  // Refs for Game Loop & Logic
  const timerRef = useRef<number>(0);
  const endTimeRef = useRef<number>(0);
  const timeLimitRef = useRef(0);
  const lastBackPressRef = useRef<number>(0);
  // Touch handling is encapsulated by useSwipeDirection
  
  // Critical: Use Ref for swipe validation to avoid closure staleness during rapid inputs
  // Stores objects now to track specific IDs
  const requiredSwipesRef = useRef<SwipeRequirement[]>([]);

  // Currency (Gems) Hook
  const { gems, addGemsForScore, deductGems, grantGems } = useCurrency();
  
  // Inventory Hook
  const { 
    saveMeCount, 
    buySaveMe, 
    useSaveMe, 
    getSaveMeCost,
    ownedItems,
    equippedSkinId,
    buyShopItem,
    equipSkin,
    hydrateInventory
  } = useInventory();

  const isSkinActive = !!equippedSkinId;
  const makeColorSlug = (name: string) => (name || '').toLowerCase();
  const skinKey = (colorName: string) => `${equippedSkinId || ''}:${makeColorSlug(colorName)}`;
  const [skinImageUrls, setSkinImageUrls] = useState<Record<string, string | null>>({});
  
  // Load skin image from cache whenever equippedSkinId changes
  useEffect(() => {
    if (!equippedSkinId || !skinAssetsReady) return;
    
    const loadImages = async () => {
      const urls: Record<string, string | null> = {};
      for (const color of COLORS) {
        const url = await SkinCacheManager.getSkinImage(equippedSkinId, color);
        // Store with lowercase key for consistent lookups
        urls[color.toLowerCase()] = url;
        console.log(`🖼️ Loaded image for ${color.toLowerCase()}: ${url ? 'blob URL' : 'failed'}`);
      }
      setSkinImageUrls(urls);
      console.log(`✅ All ${equippedSkinId} skin images loaded into memory`);
    };
    
    loadImages();
  }, [equippedSkinId, skinAssetsReady]);
  
  const getSkinImageUrl = (colorName: string): string | null => {
    const key = colorName.toLowerCase();
    const url = skinImageUrls[key] || null;
    if (!url && isSkinActive) {
      console.warn(`⚠️ getSkinImageUrl("${colorName}"): key="${key}", found=${!!url}, skinImageUrls keys=${Object.keys(skinImageUrls)}`);
    }
    return url;
  };

  const handleSkinImgError = (colorName: string) => {
    const key = skinKey(colorName);
    setFailedSkinKeys(prev => new Set([...prev, key]));
  };

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

  // Pre-warm shop images on app startup
  useEffect(() => {
    const prewarm = async () => {
      try {
        const items = await fetchShopItems();
        const versionForItem = (item: ShopItem): string => {
          try {
            const ms = item.updated_at ? Date.parse(item.updated_at) : Date.now();
            if (Number.isFinite(ms)) return String(Math.floor(ms / 60000));
          } catch {}
          return '1';
        };
        const urls = items
          .filter(i => !!i.image_url)
          .map(i => ImageCacheManager.appendVersion(i.image_url as string, versionForItem(i)));
        if (urls.length > 0) {
          await ImageCacheManager.preload(urls);
          console.log(`🔥 Pre-warmed ${urls.length} shop images`);
        }
      } catch (e) {
        console.warn('Failed to pre-warm shop images:', e);
      }
    };
    if (isOnline) prewarm();
  }, [isOnline]);

  // Handle Capacitor back button (double-press to exit on main)
  useEffect(() => {
    const setupBackButton = async () => {
      const listener = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        if (showShop) {
          lastBackPressRef.current = 0;
          setShowShop(false);
          return;
        }
        if (showLeaderboard) {
          lastBackPressRef.current = 0;
          setShowLeaderboard(false);
          return;
        }
        if (showInstructions) {
          lastBackPressRef.current = 0;
          setShowInstructions(false);
          return;
        }
        if (showEditName) {
          lastBackPressRef.current = 0;
          setShowEditName(false);
          return;
        }
        if (isPlaying) {
          // Ignore back during gameplay
          return;
        }

        // Main screen: require double back within 1.5s to exit
        const now = Date.now();
        if (now - lastBackPressRef.current < 1500) {
          CapacitorApp.exitApp();
          return;
        }
        lastBackPressRef.current = now;
        setExitHintVisible(true);
        setTimeout(() => setExitHintVisible(false), 1500);
      });

      return () => {
        listener.remove();
      };
    };

    setupBackButton();
  }, [showShop, showLeaderboard, showInstructions, showEditName, isPlaying]);

  // Hide exit hint when starting gameplay
  useEffect(() => {
    if (isPlaying && exitHintVisible) {
      setExitHintVisible(false);
    }
  }, [isPlaying, exitHintVisible]);

  // No history manipulation needed for overlays; handled via back button listener

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

  // Offline-first hydration: local first (initial state), then reconcile with Supabase when online
  useEffect(() => {
    if (!username || !navigator.onLine) return;
    let cancelled = false;

    const reconcile = (remoteOwned: string[], remoteEquipped: string | null, remoteSaveMe?: number) => {
      const ownedLocal = [...ownedItems].sort();
      const ownedRemoteSorted = [...remoteOwned].sort();
      const ownedDiff = JSON.stringify(ownedLocal) !== JSON.stringify(ownedRemoteSorted);
      const equippedDiff = remoteEquipped !== (equippedSkinId || null);
      const saveMeDiff = typeof remoteSaveMe === 'number' && remoteSaveMe !== saveMeCount;

      if (ownedDiff || equippedDiff || saveMeDiff) {
        hydrateInventory({
          ownedItems: ownedDiff ? remoteOwned : undefined,
          equippedSkinId: equippedDiff ? remoteEquipped : undefined,
          saveMeCount: saveMeDiff ? remoteSaveMe : undefined
        });
      }
    };

    (async () => {
      const profile = await fetchProfileInventory(username);
      if (!profile || cancelled) return;
      reconcile(profile.ownedItems || [], profile.equippedSkinId || null, profile.saveMeCount);
    })();

    return () => { cancelled = true; };
  }, [username, ownedItems, equippedSkinId, saveMeCount, hydrateInventory]);

  // --- Shop Handlers ---
  const handleBuySaveMe = useCallback(() => {
    const ok = buySaveMe(gems, deductGems);
    if (ok) {
      // Best-effort sync (non-blocking)
      syncProfileData(username, { save_me_count: saveMeCount + 1 });
    }
    return ok;
  }, [buySaveMe, gems, deductGems, username, saveMeCount]);

  const handleBuyItem = useCallback((item: ShopItem) => {
    // Bridge types: ensure includes supported fields
    const purchItem: PurchasableItem = { id: item.id, price: item.price, type: item.type };
    const res = buyShopItem(purchItem, gems, deductGems);
    if (res.ok) {
      const updated = res.updated || {};
      const data: { save_me_count?: number; owned_items?: string[]; equipped_skin_id?: string | null } = {};
      if (typeof updated.saveMeCount === 'number') data.save_me_count = updated.saveMeCount;
      if (Array.isArray(updated.ownedItems)) data.owned_items = updated.ownedItems;
      if (updated.equippedSkinId !== undefined) data.equipped_skin_id = updated.equippedSkinId;
      // Attempt Supabase sync; fire and forget
      if (Object.keys(data).length > 0) syncProfileData(username, data);
    }
    return res;
  }, [buyShopItem, gems, deductGems, username]);

  const handleEquip = useCallback((skinId: string) => {
    console.log(`🎨 Equip requested: "${skinId}"`);
    // Clear failed skin cache when equipping
    setFailedSkinKeys(new Set());
    
    // Allow empty string to unequip
    if (skinId === '') {
      console.log(`👕 Unequipping skin`);
      equipSkin('');
      setSkinAssetsReady(true);
      setLoadingSkinAssets(false);
      syncProfileData(username, { equipped_skin_id: null, owned_items: ownedItems }).catch(() => {});
    } else {
      console.log(`⏳ Starting preload for "${skinId}"`);
      equipSkin(skinId);
      setLoadingSkinAssets(true);
      setSkinAssetsReady(false);
      
      // Pre-download and cache all 4 color PNGs
      SkinCacheManager.preloadSkin(skinId)
        .then(() => {
          console.log(`✅ Skin "${skinId}" ready for gameplay`);
          setSkinAssetsReady(true);
          setLoadingSkinAssets(false);
        })
        .catch((error) => {
          console.error(`❌ Failed to load skin "${skinId}":`, error);
          // Still allow gameplay but fall back to colors
          setSkinAssetsReady(true);
          setLoadingSkinAssets(false);
        });
      
      syncProfileData(username, { equipped_skin_id: skinId, owned_items: ownedItems }).catch(() => {});
    }
  }, [equipSkin, username, ownedItems]);

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

    const { challenge: nextChallenge, requiredSwipes: nextSwipes, timerBarColor: nextTimerColor } = genChallenge(gameMode);

    setChallenge(nextChallenge);
    setTimerBarColor(nextTimerColor);
    requiredSwipesRef.current = nextSwipes;
    setBlockAnimationKey(prev => prev + 1); // Trigger pop animation
  }, [gameMode]);

  const finalizeGameOver = useCallback((reason: string) => {
    setIsPlaying(false);
    setIsGameOver(true);
    setRevivePromptActive(false);
    setReviving(false);

    // High Score Logic
    let isNewHigh = false;
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem(`${BASE_HIGH_SCORE_KEY}${gameMode}`, score.toString());
      isNewHigh = true;
    }
    setIsNewHighScore(isNewHigh);

    // Leaderboard Submission (async, non-blocking)
    if (score > 0) {
      const finalName = username === 'Anonymous' ? 'Anonymous' : username;
      submitScore(finalName, score, gameMode);
    }

    // Currency: calculate and persist earned gems
    try {
      const earned = addGemsForScore(score, gameMode);
      setLastEarnedGems(earned);
      
      // Show floating gem notification
      if (earned > 0) {
        setShowGemFloating(true);
        setTimeout(() => setShowGemFloating(false), 1800);
      }
    } catch {}
  }, [score, highScore, gameMode, username, addGemsForScore]);

  const endGame = useCallback((reason: string) => {
    if (reviving || revivePromptActive) return;
    setGameOverReason(reason);
    if (saveMeCount > 0) {
      // Keep playing state true so game area stays visible
      setRevivePromptActive(true);
      setReviveTimeLeft(5);
      return;
    }
    setIsPlaying(false);
    setIsGameOver(true);
    finalizeGameOver(reason);
  }, [reviving, revivePromptActive, saveMeCount, finalizeGameOver]);

  const applyRevive = useCallback(() => {
    // Escalating Save Me cost per game
    const useIndex = reviveUses + 1;
    const cost = useIndex === 1 ? 1 : useIndex === 2 ? 3 : useIndex === 3 ? 5 : 5 * Math.pow(2, useIndex - 3);
    if (saveMeCount < cost) {
      setReviving(false);
      setRevivePromptActive(false);
      finalizeGameOver(gameOverReason || "");
      return;
    }
    let ok = true;
    for (let i = 0; i < cost; i++) {
      const used = useSaveMe();
      if (!used) { ok = false; break; }
    }
    setReviving(false);
    setRevivePromptActive(false);
    if (!ok) {
      finalizeGameOver(gameOverReason || "");
      return;
    }

    setReviveUses(prev => prev + 1);
    // Reset minimal state and resume gameplay
    setIsGameOver(false);
    setIsNewHighScore(false);
    setLastEarnedGems(0);
    endTimeRef.current = Date.now() + timeLimitRef.current;
    setTimeLeft(timeLimitRef.current);
    setIsPlaying(true);
  }, [useSaveMe, finalizeGameOver, gameOverReason, reviveUses, saveMeCount]);

  // Revive prompt 5-second countdown
  useEffect(() => {
    if (!revivePromptActive) return;
    setReviveTimeLeft(5);
    const interval = setInterval(() => {
      setReviveTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setRevivePromptActive(false);
          finalizeGameOver(gameOverReason || "");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [revivePromptActive, finalizeGameOver, gameOverReason]);

  // 3-2-1-GO buffer
  useEffect(() => {
    if (!reviving) return;
    const sequence = ['3', '2', '1', 'GO'];
    let idx = 0;
    setRevivingLabel(sequence[0]);
    const interval = setInterval(() => {
      idx += 1;
      if (idx >= sequence.length) {
        clearInterval(interval);
        setTimeout(() => applyRevive(), 200);
        return;
      }
      setRevivingLabel(sequence[idx]);
    }, 800);
    return () => clearInterval(interval);
  }, [reviving, applyRevive]);

  // --- Game Loop ---
  const gameLoop = useCallback(() => {
    // Pause during revive
    if (revivePromptActive || reviving) {
      timerRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    const now = Date.now();
    const remaining = Math.max(0, endTimeRef.current - now);
    
    setTimeLeft(remaining);

    if (remaining <= 0) {
      endGame("TIME'S UP!");
    } else {
      timerRef.current = requestAnimationFrame(gameLoop);
    }
  }, [endGame, revivePromptActive, reviving]);

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = requestAnimationFrame(gameLoop);
    }
    return () => {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
    };
  }, [isPlaying, gameLoop]);

  const startGame = () => {
    // Block game start if skin assets aren't ready
    if (equippedSkinId && !skinAssetsReady) {
      return;
    }
    
    setScore(0);
    setIsGameOver(false);
    setIsNewHighScore(false);
    setIsPlaying(true);
    setGameOverReason('');
    setCompletedBlockIds([]);
    setLastEarnedGems(0);
    setReviveUses(0);
    
    // Reset gem animation
    setShowGemFloating(false);
    
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
    if (!isPlaying || reviving || revivePromptActive) return;

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
  }, [isPlaying, reviving, revivePromptActive, score, gameMode, endGame, generateChallenge]);

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

  // Hook-based touch swipe detection
  const { onTouchStart, onTouchEnd } = useSwipeDirection(handleInput, isPlaying);

  // --- Render Helpers ---

  // Calculate timer progress percentage
  const timerProgress = timeLimitRef.current > 0 
    ? Math.min(100, Math.max(0, (timeLeft / timeLimitRef.current) * 100)) 
    : 0;

  // Next revive cost based on escalating usage per game
  const nextReviveCost = (() => {
    const useIndex = reviveUses + 1;
    if (useIndex === 1) return 1;
    if (useIndex === 2) return 3;
    if (useIndex === 3) return 5;
    return 5 * Math.pow(2, useIndex - 3);
  })();

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
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Exit hint toast */}
      {exitHintVisible && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#1a1d23] border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-gray-200 shadow-lg z-[60]">
          Press back again to exit
        </div>
      )}
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
                   const showSkin = isSkinActive && !failedSkinKeys.has(skinKey(item.color));
                   return (
                     <div 
                        key={item.id}
                        className={`relative w-32 h-32 rounded-3xl shadow-[0_0_30px_rgba(0,0,0,0.5)] transition-all duration-150 ${
                          showSkin ? '' : 'border-4 border-white'
                        } ${
                          isCompleted ? 'opacity-0 scale-50' : 'opacity-100 scale-100 animate-pop'
                        }`}
                        style={{ backgroundColor: showSkin ? 'transparent' : CSS_COLORS[item.color] }}
                     >
                       {showSkin && getSkinImageUrl(item.color) && (
                         <img
                           src={getSkinImageUrl(item.color) || ''}
                           alt={item.color}
                           loading="eager"
                           onError={() => handleSkinImgError(item.color)}
                           className="absolute inset-0 w-full h-full object-cover rounded-3xl select-none"
                           draggable={false}
                         />
                       )}
                     </div>
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
                  className={`relative w-40 h-40 rounded-3xl shadow-[0_0_30px_rgba(0,0,0,0.5)] animate-pop transition-colors duration-150 ease-linear ${
                    (isSkinActive && !failedSkinKeys.has(skinKey(challenge.blockColor))) ? '' : 'border-4 border-white'
                  }`}
                  style={{ backgroundColor: (isSkinActive && !failedSkinKeys.has(skinKey(challenge.blockColor))) ? 'transparent' : CSS_COLORS[challenge.blockColor] }}
                >
                  {isSkinActive && !failedSkinKeys.has(skinKey(challenge.blockColor)) && getSkinImageUrl(challenge.blockColor) && (
                    <img
                      src={getSkinImageUrl(challenge.blockColor) || ''}
                      alt={challenge.blockColor}
                      loading="eager"
                      onError={() => handleSkinImgError(challenge.blockColor)}
                      className="absolute inset-0 w-full h-full object-cover rounded-3xl select-none"
                      draggable={false}
                    />
                  )}
                </div>
              </>
            )}
            
            {/* Visual Guide for Desktop */}
            <div className="absolute bottom-8 text-gray-500 text-sm hidden md:block opacity-50 select-none">
              Use Arrow Keys or WASD
            </div>
          </>
        )}
      </div>

      {/* Reviving 3-2-1 overlay */}
      {reviving && (
        <div className="absolute inset-0 bg-black/30 z-[70] flex items-center justify-center">
          <div className="text-8xl font-extrabold text-white animate-pulse-fast" style={{ textShadow: '0 0 40px rgba(255,255,255,0.8), 0 0 80px rgba(0,255,136,0.6)' }}>
            {revivingLabel}
          </div>
        </div>
      )}

      {/* Revive prompt overlay (during gameplay) */}
      {revivePromptActive && saveMeCount > 0 && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px] z-[65] flex items-center justify-center p-4">
          <div className="relative w-full max-w-md">
            {/* Animated background glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 via-purple-500/20 to-yellow-500/20 rounded-3xl blur-xl animate-pulse"></div>
            
            <div className="relative bg-gradient-to-b from-[#1a1d23] to-[#0f1115] border-2 border-red-400/50 rounded-3xl p-6 shadow-2xl">
              {/* Top banner */}
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gradient-to-r from-red-500 to-pink-500 px-6 py-2 rounded-full border-2 border-white/20 shadow-lg">
                <span className="text-white font-extrabold text-lg tracking-wider">CONTINUE?</span>
              </div>

              {/* Countdown circle */}
              <div className="flex justify-center mt-4 mb-6">
                <div className="relative w-24 h-24 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-yellow-500/30"></div>
                  <div className="text-5xl font-extrabold text-yellow-300 animate-pulse-fast">{reviveTimeLeft}</div>
                </div>
              </div>

              {/* Save Me icon */}
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <Heart fill="currentColor" className="text-red-500 animate-pulse" size={60} />
                  <div className="absolute -top-2 -right-2 bg-white text-black font-bold text-sm w-8 h-8 rounded-full flex items-center justify-center border-2 border-red-500">
                    {saveMeCount}
                  </div>
                </div>
              </div>

              {/* Next revive cost indicator */}
              <div className="text-center text-sm font-bold text-red-300 mb-4">
                Uses: {nextReviveCost}
              </div>

              {/* Buttons */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    setRevivePromptActive(false);
                    setReviving(true);
                  }}
                  className="relative overflow-hidden bg-gradient-to-r from-game-green to-emerald-400 text-black font-extrabold py-4 rounded-xl shadow-lg hover:scale-105 transition-transform"
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                  <span className="relative text-lg">REVIVE</span>
                </button>
                <button
                  onClick={() => finalizeGameOver(gameOverReason || '')}
                  className="bg-gray-800/80 border-2 border-gray-600 text-gray-300 font-bold py-4 rounded-xl hover:bg-gray-700 transition-colors"
                >
                  Give Up
                </button>
              </div>
            </div>
```
          </div>
        </div>
      )}

      {/* --- Overlay (Menu / Game Over) --- */}
      {(!isPlaying && !revivePromptActive) && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          {/* Gems Counter (Top-left) */}
          <div id="gem-counter" className="absolute top-12 left-6 bg-[#1a1d23] border border-white/10 rounded-xl px-4 py-2 shadow-2xl flex items-center gap-3">
            {/* Gradient Gem Icon */}
            <div 
              className="w-4 h-4 rounded-full flex items-center justify-center shadow-lg"
              style={{ 
                background: 'linear-gradient(135deg, #ff4e50 0%, #a855f7 100%)',
                boxShadow: '0 4px 12px rgba(168, 85, 247, 0.4)'
              }}
            >
              <div className="w-1 h-1 bg-white/30 rounded-full" />
            </div>
            {/* Gem Count */}
            <span className="font-mono font-bold text-white text-lg">
              {gems}
            </span>
          </div>

          {/* Save Me Counter (Top-right) */}
          <div className="absolute top-12 right-6 bg-[#1a1d23] border border-white/10 rounded-xl px-4 py-2 shadow-2xl flex items-center gap-3">
            <Heart fill="currentColor" className="text-red-500 drop-shadow" size={18} />
            <span className="font-mono font-bold text-white text-lg">{saveMeCount}</span>
          </div>
          
          {/* Floating Gem Notification */}
          {showGemFloating && (
            <div 
              className="absolute top-20 left-6 animate-bounce"
              style={{
                animation: 'float-up 1.8s ease-out forwards'
              }}
            >
              <div className="bg-game-green text-black font-bold text-lg px-3 py-1 rounded-lg shadow-lg font-mono whitespace-nowrap">
                +{lastEarnedGems} {lastEarnedGems === 1 ? 'Gem' : 'Gems'}
              </div>
            </div>
          )}
          
          <div className="w-full max-w-sm bg-gradient-to-b from-[#14171c] to-[#0c0e12] border border-white/10 rounded-[2rem] p-8 shadow-2xl flex flex-col items-center">
            {/* Title */}
            <div className="flex flex-col items-center mb-6">
              <span className="text-3xl font-extrabold text-[#1fd4a5] tracking-wider">COLOR</span>
              <span className="text-3xl font-extrabold text-[#2a8bff] tracking-wider">SWIPE</span>
            </div>

            {/* Game Over Message */}
            {isGameOver && !reviving && (
              <div className="mb-4 w-full text-center animate-pulse-fast">
                <h2 className="text-lg font-bold text-gray-200">{gameOverReason}</h2>
                <div className="text-3xl font-mono font-bold mt-1 text-white">
                  {score}
                  {isNewHighScore && <span className="text-xs ml-2 text-yellow-400 align-top">NEW HIGH!</span>}
                </div>
              </div>
            )}

            {/* Mode Select */}
            <div className="grid grid-cols-3 gap-2 w-full mb-6">
              <button 
                onClick={() => changeMode('NORMAL')}
                className={`p-2 rounded-xl border flex flex-col items-center justify-center transition-all relative ${
                  gameMode === 'NORMAL' 
                    ? 'bg-game-green/10 border-game-green shadow-[0_0_15px_rgba(0,255,136,0.2)]' 
                    : 'bg-[#171a1f] border-white/5 hover:border-white/20'
                }`}
              >
                {gameMode === 'NORMAL' && (
                  <span 
                    className="absolute top-1 right-1 text-[8px] font-bold text-game-green bg-game-green/20 px-1 py-0.5 rounded border border-game-green/50"
                    style={{ boxShadow: '0 0 8px rgba(0, 255, 136, 0.5)' }}
                  >
                    x1
                  </span>
                )}
                <Target size={16} className={`mb-1 ${gameMode === 'NORMAL' ? 'text-game-green' : 'text-gray-500'}`} />
                <span className={`font-bold text-xs ${gameMode === 'NORMAL' ? 'text-game-green' : 'text-gray-400'}`}>NORMAL</span>
              </button>
              
              <button 
                onClick={() => changeMode('HARD')}
                className={`p-2 rounded-xl border flex flex-col items-center justify-center transition-all relative ${
                  gameMode === 'HARD' 
                    ? 'bg-game-red/10 border-game-red shadow-[0_0_15px_rgba(255,95,82,0.2)]' 
                    : 'bg-[#171a1f] border-white/5 hover:border-white/20'
                }`}
              >
                {gameMode === 'HARD' && (
                  <span 
                    className="absolute top-1 right-1 text-[8px] font-bold text-game-red bg-game-red/20 px-1 py-0.5 rounded border border-game-red/50"
                    style={{ boxShadow: '0 0 8px rgba(255, 95, 82, 0.5)' }}
                  >
                    x2
                  </span>
                )}
                <Flame size={16} className={`mb-1 ${gameMode === 'HARD' ? 'text-game-red' : 'text-gray-500'}`} />
                <span className={`font-bold text-xs ${gameMode === 'HARD' ? 'text-game-red' : 'text-gray-400'}`}>HARD</span>
              </button>

              <button 
                onClick={() => changeMode('INSANE')}
                className={`p-2 rounded-xl border flex flex-col items-center justify-center transition-all relative ${
                  gameMode === 'INSANE' 
                    ? 'bg-purple-500/10 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.2)]' 
                    : 'bg-[#171a1f] border-white/5 hover:border-white/20'
                }`}
              >
                {gameMode === 'INSANE' && (
                  <span 
                    className="absolute top-1 right-1 text-[8px] font-bold text-purple-400 bg-purple-500/20 px-1 py-0.5 rounded border border-purple-500/50"
                    style={{ boxShadow: '0 0 8px rgba(168, 85, 247, 0.5)' }}
                  >
                    x3
                  </span>
                )}
                <Zap size={16} className={`mb-1 ${gameMode === 'INSANE' ? 'text-purple-500' : 'text-gray-500'}`} />
                <span className={`font-bold text-xs ${gameMode === 'INSANE' ? 'text-purple-500' : 'text-gray-400'}`}>INSANE</span>
              </button>
            </div>

            {/* Start Button */}
            <button 
              onClick={startGame}
              disabled={loadingSkinAssets}
              className={`w-full text-black font-extrabold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 mb-6 text-lg ${
                loadingSkinAssets
                  ? 'bg-gray-500 text-gray-700 cursor-not-allowed opacity-60'
                  : 'bg-gradient-to-b from-white to-gray-200 hover:translate-y-[1px] hover:shadow-md active:translate-y-[2px]'
              }`}
            >
              {loadingSkinAssets ? (
                <>
                  <div className="w-5 h-5 border-2 border-gray-700 border-t-white rounded-full animate-spin" />
                  <span>Downloading Assets...</span>
                </>
              ) : (
                <>
                  <Play fill="black" size={20} />
                  {isGameOver ? 'TRY AGAIN' : 'START GAME'}
                </>
              )}
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

              {/* Shop Btn */}
              <button 
                onClick={() => setShowShop(true)}
                className="bg-[#1a1d23] border border-white/5 rounded-xl p-3 flex items-center gap-3 hover:bg-[#252830] transition-colors text-left"
              >
                <ShoppingBag className="text-purple-400" size={20} />
                <span className="text-xs font-bold text-white">Shop</span>
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-3 w-full mt-3">
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

              {/* Leaderboard Btn */}
              <button 
                onClick={() => isOnline && setShowLeaderboard(true)}
                disabled={!isOnline}
                className={`bg-[#1a1d23] border border-white/5 rounded-xl p-3 flex items-center gap-3 transition-colors ${
                  !isOnline ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#252830]'
                }`}
              >
                 {isOnline ? (
                   <BarChart2 className="text-purple-400" size={20} />
                 ) : (
                   <WifiOff className="text-gray-500" size={20} />
                 )}
                 <span className="text-xs font-bold text-white">Rank</span>
              </button>
            </div>
            
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
      {showShop && (
        <Shop 
          gems={gems}
          saveMeCount={saveMeCount}
          saveMeCost={getSaveMeCost()}
          onClose={() => setShowShop(false)}
          onBuy={handleBuySaveMe}
          ownedItems={ownedItems}
          equippedSkinId={equippedSkinId || undefined}
          onBuyItem={handleBuyItem}
          onEquip={handleEquip}
        />
      )}
    </div>
  );
}