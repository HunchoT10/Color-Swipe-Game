import { SUPABASE_URL, COLORS as GAME_COLORS } from '../constants';

const CACHE_NAME = 'game-assets-v2';
// Use lowercase for file names (skins/slug/red.png, etc.)
const COLORS = GAME_COLORS.map(c => c.toLowerCase());

export class SkinCacheManager {
  /**
   * Pre-download all 4 color PNGs for a skin into the persistent cache.
   * Returns a promise that resolves when all assets are cached.
   */
  static async preloadSkin(slug: string): Promise<void> {
    try {
      const cache = await caches.open(CACHE_NAME);
      const promises = COLORS.map(color => this.cacheSkinImage(slug, color, cache));
      await Promise.all(promises);
      console.log(`✅ Skin "${slug}" fully cached with all 4 colors`);
    } catch (error) {
      console.error(`Failed to preload skin "${slug}":`, error);
      throw error;
    }
  }

  /**
   * Cache a single skin image by fetching from Supabase and storing.
   */
  private static async cacheSkinImage(slug: string, color: string, cache: Cache): Promise<void> {
    const url = this.buildSkinUrl(slug, color);
    try {
      const response = await fetch(url);
      if (response.ok) {
        await cache.put(url, response.clone());
        console.log(`  📦 Cached: ${slug}/${color}`);
      } else {
        console.warn(`  ⚠️ Failed to fetch ${slug}/${color}: ${response.status}`);
      }
    } catch (error) {
      console.warn(`  ⚠️ Network error caching ${slug}/${color}:`, error);
    }
  }

  /**
   * Get a skin image: check cache first, fetch if not cached.
   * Returns a blob URL that can be used immediately.
   */
  static async getSkinImage(slug: string, color: string): Promise<string | null> {
    try {
      const url = this.buildSkinUrl(slug, color);
      const cache = await caches.open(CACHE_NAME);
      
      // Try cache first
      const cached = await cache.match(url);
      if (cached) {
        const blob = await cached.blob();
        const blobUrl = URL.createObjectURL(blob);
        console.log(`📦 Asset loaded from Forever Cache: ${slug}/${color} → blob URL: ${blobUrl.substring(0, 50)}...`);
        return blobUrl;
      }

      // Not in cache, fetch from network
      console.log(`🔄 Fetching from network: ${url}`);
      const response = await fetch(url);
      if (response.ok) {
        const blob = await response.blob();
        // Store in cache for future use
        await cache.put(url, new Response(blob));
        const blobUrl = URL.createObjectURL(blob);
        console.log(`📥 Asset fetched from network and cached: ${slug}/${color} → blob URL: ${blobUrl.substring(0, 50)}...`);
        return blobUrl;
      }
      
      console.warn(`Failed to load image: ${slug}/${color} (${response.status}) from ${url}`);
      return null;
    } catch (error) {
      console.error(`Error getting skin image ${slug}/${color}:`, error);
      return null;
    }
  }

  /**
   * Check if all 4 colors for a skin are cached and ready.
   */
  static async isSkinCached(slug: string): Promise<boolean> {
    try {
      const cache = await caches.open(CACHE_NAME);
      const checks = await Promise.all(
        COLORS.map(color => cache.match(this.buildSkinUrl(slug, color)))
      );
      return checks.every(r => !!r);
    } catch {
      return false;
    }
  }

  /**
   * Build the Supabase Storage URL for a skin image.
   * Adds a timestamp param for cache busting so updated images are always fetched fresh.
   */
  private static buildSkinUrl(slug: string, color: string): string {
    const s = encodeURIComponent(slug);
    const c = encodeURIComponent(color.toLowerCase());
    // Add timestamp query param to bust cache when images are updated on Supabase
    const timestamp = Math.floor(Date.now() / 60000); // Round down to nearest minute for consistency
    return `${SUPABASE_URL}/storage/v1/object/public/skins/${s}/${c}.png?v=${timestamp}`;
  }

  /**
   * Clear the entire cache (optional cleanup).
   */
  static async clearCache(): Promise<void> {
    try {
      await caches.delete(CACHE_NAME);
      console.log('Cache cleared');
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }
}
