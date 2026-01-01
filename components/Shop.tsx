import React, { useEffect, useState } from 'react';
import { X, ShoppingBag, AlertCircle, CheckCircle, Heart, ArrowLeft, Image as ImageIcon, Loader2 } from 'lucide-react';
import { fetchShopItems, ShopItem } from '../services/supabaseService';
import { ImageCacheManager } from '../services/imageCacheManager';

interface ShopProps {
  gems: number;
  saveMeCount: number;
  saveMeCost: number;
  onClose: () => void;
  onBuy: () => boolean; // Save Me
  ownedItems?: string[];
  equippedSkinId?: string;
  onBuyItem?: (item: ShopItem) => { ok: boolean; message?: string };
  onEquip?: (itemId: string) => void;
}

const Shop: React.FC<ShopProps> = ({ gems, saveMeCount, saveMeCost, onClose, onBuy, ownedItems = [], equippedSkinId, onBuyItem, onEquip }) => {
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [dynamicItems, setDynamicItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [imageSrcs, setImageSrcs] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const loadItems = async () => {
      setLoading(true);
      const items = await fetchShopItems();
      
      // Sort: NEW EVENT items first, then by date
      const sorted = items.sort((a, b) => {
        const aIsNew = isNewEvent(a);
        const bIsNew = isNewEvent(b);
        if (aIsNew && !bIsNew) return -1;
        if (!aIsNew && bIsNew) return 1;
        
        // Both new or both old: sort by updated_at desc
        const aTime = a.updated_at ? Date.parse(a.updated_at) : 0;
        const bTime = b.updated_at ? Date.parse(b.updated_at) : 0;
        return bTime - aTime;
      });
      
      setDynamicItems(sorted);
      setLoading(false);
    };
    loadItems();
  }, []);

  // Preload and cache shop item images; populate blob URLs
  useEffect(() => {
    const versionForItem = (item: ShopItem): string => {
      try {
        const ms = item.updated_at ? Date.parse(item.updated_at) : Date.now();
        if (Number.isFinite(ms)) return String(Math.floor(ms / 60000));
      } catch {}
      return '1';
    };

    const run = async () => {
      const urls = dynamicItems
        .filter(i => !!i.image_url)
        .map(i => ImageCacheManager.appendVersion(i.image_url as string, versionForItem(i)));

      if (urls.length) {
        await ImageCacheManager.preload(urls);
      }

      const entries: Record<string, string | null> = {};
      for (const item of dynamicItems) {
        if (!item.image_url) {
          entries[item.id] = null;
          continue;
        }
        const url = ImageCacheManager.appendVersion(item.image_url, versionForItem(item));
        const blobUrl = await ImageCacheManager.getImage(url);
        entries[item.id] = blobUrl || item.image_url;
      }
      setImageSrcs(entries);
    };

    if (dynamicItems.length > 0) run();
  }, [dynamicItems]);

  const handleBuy = () => {
    const success = onBuy();
    if (success) {
      setFeedback({ type: 'success', message: 'Purchase successful!' });
      setTimeout(() => setFeedback(null), 2000);
    } else {
      setFeedback({ type: 'error', message: 'Not enough gems!' });
      setTimeout(() => setFeedback(null), 2000);
    }
  };

  const handleImageError = (itemId: string) => {
    setImageErrors(prev => new Set([...prev, itemId]));
  };

  const canAfford = gems >= saveMeCost;

  const isCosmetic = (type?: string) => type === 'emoji_skin' || type === 'theme' || type === 'skin';
  const isOwned = (id: string) => ownedItems?.includes(id);
  const isEquippedSlug = (slug?: string) => !!slug && equippedSkinId === slug;
  const isNewEvent = (item: ShopItem) => {
    if (!item.updated_at) return false;
    const updated = new Date(item.updated_at).getTime();
    if (!Number.isFinite(updated)) return false;
    const now = Date.now();
    const twoDays = 48 * 60 * 60 * 1000;
    return now - updated <= twoDays;
  };

  const buyItem = (item: ShopItem) => {
    if (!onBuyItem) return;
    const res = onBuyItem(item);
    if (res.ok) {
      setFeedback({ type: 'success', message: res.message || 'Purchase successful!' });
    } else {
      setFeedback({ type: 'error', message: res.message || 'Unable to purchase' });
    }
    setTimeout(() => setFeedback(null), 2000);
  };

  return (
    <div className="fixed inset-0 bg-game-bg text-white bg-[radial-gradient(circle_at_20%_20%,_rgba(0,255,136,0.08),_transparent_30%),_radial-gradient(circle_at_80%_10%,_rgba(0,153,255,0.08),_transparent_25%)] z-50 flex flex-col">
      <div className="w-full max-w-2xl mx-auto flex flex-col h-full">
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-gradient-to-b from-[#14171c] to-transparent">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <ArrowLeft size={28} />
            </button>
            <ShoppingBag className="text-blue-400" size={24} />
            <h3 className="text-2xl font-bold text-white">Shop</h3>
          </div>
        </div>

        {/* Gem Balance Display */}
        <div className="px-6 py-4 bg-black/20 border-b border-white/5 flex items-center justify-between">
          <span className="text-base text-gray-400 font-medium">Your Balance:</span>
          <div className="flex items-center gap-2">
            <div 
              className="w-4 h-4 rounded-full flex items-center justify-center"
              style={{ 
                background: 'linear-gradient(135deg, #ff4e50 0%, #a855f7 100%)',
                boxShadow: '0 2px 8px rgba(168, 85, 247, 0.3)'
              }}
            >
              <div className="w-1 h-1 bg-white/30 rounded-full" />
            </div>
            <span className="font-mono font-bold text-white text-lg">{gems}</span>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Fixed: Save Me Item */}
          <div className="bg-[#1a1d23] border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-3 flex-1">
                <div className="w-10 h-10 flex items-center justify-center">
                  <Heart 
                    size={32} 
                    className="text-red-500 fill-red-500" 
                    style={{ 
                      animation: 'heartbeat 1.5s ease-in-out infinite'
                    }} 
                  />
                  <style>{`
                    @keyframes heartbeat {
                      0%, 100% { transform: scale(1); }
                      25% { transform: scale(1.15); }
                      50% { transform: scale(1); }
                    }
                  `}</style>
                </div>
                <div className="flex-1">
                  <h4 className="text-lg font-bold text-white mb-1">Save Me</h4>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Use during a game to get an extra chance when you make a mistake. Continues your streak!
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ 
                    background: 'linear-gradient(135deg, #ff4e50 0%, #a855f7 100%)',
                    boxShadow: '0 2px 8px rgba(168, 85, 247, 0.3)'
                  }}
                >
                  <div className="w-1 h-1 bg-white/30 rounded-full" />
                </div>
                <span className="font-mono font-bold text-white text-lg">{saveMeCost}</span>
              </div>

              <button
                onClick={handleBuy}
                disabled={!canAfford}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                  canAfford
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:opacity-90 shadow-lg'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                Buy
              </button>
            </div>

            {/* Owned Count */}
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">Owned:</span>
              <span className="text-sm font-mono font-bold text-game-green">{saveMeCount}</span>
            </div>
          </div>

          {/* Dynamic Items Section */}
          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <Loader2 className="animate-spin mr-2" size={20} />
              <span>Loading items...</span>
            </div>
          ) : dynamicItems.length > 0 ? (
            <div>
              <div className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Limited Events</div>
              <div className="grid grid-cols-1 gap-4">
                {dynamicItems.map((item) => (
                  <div key={item.id} className="bg-[#1a1d23] border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all">
                    {/* New Event Tag Row */}
                    {isNewEvent(item) && (
                      <div className="mb-3 flex justify-end">
                        <span className="inline-flex items-center text-[9px] font-extrabold px-2 py-1 rounded-md bg-gradient-to-r from-amber-400 to-yellow-500 text-black shadow-sm">
                          NEW EVENT
                        </span>
                      </div>
                    )}

                    <div className="flex gap-4">
                      {/* Item Image */}
                      <div className="w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-black/40 flex items-center justify-center">
                        {imageErrors.has(item.id) || !imageSrcs[item.id] ? (
                          <ImageIcon className="text-gray-600" size={32} />
                        ) : (
                          <img
                            src={imageSrcs[item.id] || ''}
                            alt={item.name}
                            onError={() => handleImageError(item.id)}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>

                      {/* Item Details */}
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <h4 className="text-lg font-bold text-white mb-1">{item.name}</h4>
                          <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">{item.description}</p>
                        </div>

                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full flex items-center justify-center"
                              style={{ 
                                background: 'linear-gradient(135deg, #ff4e50 0%, #a855f7 100%)',
                                boxShadow: '0 2px 8px rgba(168, 85, 247, 0.3)'
                              }}
                            >
                              <div className="w-0.5 h-0.5 bg-white/30 rounded-full" />
                            </div>
                            <span className="font-mono font-bold text-white text-sm">{item.price}</span>
                          </div>

                          {isCosmetic(item.type) && isOwned(item.id) ? (
                            <button
                              onClick={() => {
                                const shouldEquip = !isEquippedSlug(item.slug);
                                console.log(`🛍️ Equip button clicked: slug="${item.slug}", shouldEquip=${shouldEquip}`);
                                onEquip && onEquip(isEquippedSlug(item.slug) ? '' : (item.slug || ''));
                              }}
                              className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                                isEquippedSlug(item.slug)
                                  ? 'bg-red-500 text-white hover:opacity-80'
                                  : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:opacity-90'
                              }`}
                            >
                              {isEquippedSlug(item.slug) ? 'Unequip' : 'Equip'}
                            </button>
                          ) : (
                            <button
                              onClick={() => buyItem(item)}
                              disabled={gems < item.price}
                              className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                                gems >= item.price
                                  ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:opacity-90'
                                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                              }`}
                            >
                              Buy
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Feedback Message */}
          {feedback && (
            <div className={`p-3 rounded-lg flex items-center gap-2 ${
              feedback.type === 'success' 
                ? 'bg-game-green/10 border border-game-green/30' 
                : 'bg-red-500/10 border border-red-500/30'
            }`}>
              {feedback.type === 'success' ? (
                <CheckCircle size={16} className="text-game-green" />
              ) : (
                <AlertCircle size={16} className="text-red-400" />
              )}
              <span className={`text-sm font-medium ${
                feedback.type === 'success' ? 'text-game-green' : 'text-red-400'
              }`}>
                {feedback.message}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Shop;
