const CACHE_NAME = 'game-assets-v2';

export class ImageCacheManager {
  /**
   * Append a stable version param to a URL. If `version` is undefined, returns the original URL.
   */
  static appendVersion(url: string, version?: string | number): string {
    if (version === undefined || version === null || version === '') return url;
    const v = encodeURIComponent(String(version));
    const hasQuery = url.includes('?');
    return `${url}${hasQuery ? '&' : '?'}v=${v}`;
  }

  /**
   * Pre-cache a list of URLs.
   */
  static async preload(urls: string[]): Promise<void> {
    if (!urls || urls.length === 0) return;
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(urls.map(async (u) => {
      try {
        const res = await fetch(u);
        if (res.ok) {
          await cache.put(u, res.clone());
          console.log(`📦 Cached shop image: ${u}`);
        } else {
          console.warn(`⚠️ Failed to fetch shop image ${u}: ${res.status}`);
        }
      } catch (e) {
        console.warn(`⚠️ Network error caching ${u}:`, e);
      }
    }));
  }

  /**
   * Get an image via cache-first. Returns a blob URL or null.
   */
  static async getImage(url: string): Promise<string | null> {
    try {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(url);
      if (cached) {
        const blob = await cached.blob();
        const blobUrl = URL.createObjectURL(blob);
        console.log(`📦 Shop image from cache → ${blobUrl.substring(0, 50)}...`);
        return blobUrl;
      }
      const response = await fetch(url);
      if (response.ok) {
        const blob = await response.blob();
        await cache.put(url, new Response(blob));
        const blobUrl = URL.createObjectURL(blob);
        console.log(`📥 Shop image fetched and cached → ${blobUrl.substring(0, 50)}...`);
        return blobUrl;
      }
      return null;
    } catch (e) {
      console.error('Error getting cached image:', e);
      return null;
    }
  }

  /**
   * Check if a URL is cached.
   */
  static async isCached(url: string): Promise<boolean> {
    try {
      const cache = await caches.open(CACHE_NAME);
      const res = await cache.match(url);
      return !!res;
    } catch {
      return false;
    }
  }
}
