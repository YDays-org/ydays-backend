import redisService from '../../config/redis.js';

class CacheService {
  constructor() {
    this.defaultTTL = 3600; // 1 hour default TTL
    this.redis = null;
  }

  async initialize() {
    try {
      this.redis = await redisService.connect();
      console.log('✅ Cache service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize cache service:', error);
      // Don't throw error - allow app to work without cache
    }
  }

  isAvailable() {
    return redisService.isReady();
  }

  // Generic cache operations
  async get(key) {
    if (!this.isAvailable()) return null;
    
    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`❌ Cache get error for key ${key}:`, error);
      return null;
    }
  }

  async set(key, value, ttl = this.defaultTTL) {
    if (!this.isAvailable()) return false;
    
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`❌ Cache set error for key ${key}:`, error);
      return false;
    }
  }

  async del(key) {
    if (!this.isAvailable()) return false;
    
    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      console.error(`❌ Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  async flush() {
    if (!this.isAvailable()) return false;
    
    try {
      await this.redis.flushdb();
      return true;
    } catch (error) {
      console.error('❌ Cache flush error:', error);
      return false;
    }
  }

  // Specific cache methods for your application
  async cacheListings(listings, filters = {}) {
    const cacheKey = this.generateListingsKey(filters);
    await this.set(cacheKey, listings, 1800); // 30 minutes for listings
    console.log(`📦 Cached listings with key: ${cacheKey}`);
  }

  async getCachedListings(filters = {}) {
    const cacheKey = this.generateListingsKey(filters);
    const cached = await this.get(cacheKey);
    if (cached) {
      console.log(`🎯 Cache hit for listings: ${cacheKey}`);
    }
    return cached;
  }

  async cacheUser(userId, userData) {
    const cacheKey = `user:${userId}`;
    await this.set(cacheKey, userData, 7200); // 2 hours for user data
    console.log(`📦 Cached user data: ${cacheKey}`);
  }

  async getCachedUser(userId) {
    const cacheKey = `user:${userId}`;
    const cached = await this.get(cacheKey);
    if (cached) {
      console.log(`🎯 Cache hit for user: ${cacheKey}`);
    }
    return cached;
  }

  async cacheBookings(userId, bookings) {
    const cacheKey = `bookings:${userId}`;
    await this.set(cacheKey, bookings, 900); // 15 minutes for bookings
    console.log(`📦 Cached bookings: ${cacheKey}`);
  }

  async getCachedBookings(userId) {
    const cacheKey = `bookings:${userId}`;
    const cached = await this.get(cacheKey);
    if (cached) {
      console.log(`🎯 Cache hit for bookings: ${cacheKey}`);
    }
    return cached;
  }

  // Backup operations
  async backupData(backupKey, data, ttl = 86400) { // 24 hours default for backups
    const key = `backup:${backupKey}:${Date.now()}`;
    await this.set(key, data, ttl);
    console.log(`💾 Data backed up with key: ${key}`);
    return key;
  }

  async getBackup(backupKey) {
    if (!this.isAvailable()) return null;
    
    try {
      const pattern = `backup:${backupKey}:*`;
      const keys = await this.redis.keys(pattern);
      
      if (keys.length === 0) return null;
      
      // Get the most recent backup (highest timestamp)
      const latestKey = keys.sort().pop();
      const data = await this.get(latestKey);
      
      console.log(`🔄 Retrieved backup: ${latestKey}`);
      return data;
    } catch (error) {
      console.error(`❌ Backup retrieval error for ${backupKey}:`, error);
      return null;
    }
  }

  async listBackups(backupKey) {
    if (!this.isAvailable()) return [];
    
    try {
      const pattern = `backup:${backupKey}:*`;
      const keys = await this.redis.keys(pattern);
      
      return keys.map(key => {
        const timestamp = key.split(':').pop();
        return {
          key,
          timestamp: new Date(parseInt(timestamp)),
          backupKey
        };
      }).sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error(`❌ Backup listing error for ${backupKey}:`, error);
      return [];
    }
  }

  // Cache invalidation
  async invalidateUserCache(userId) {
    await this.del(`user:${userId}`);
    await this.del(`bookings:${userId}`);
    console.log(`🗑️ Invalidated cache for user: ${userId}`);
  }

  async invalidateListingsCache() {
    if (!this.isAvailable()) return;
    
    try {
      const keys = await this.redis.keys('listings:*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
        console.log(`🗑️ Invalidated ${keys.length} listings cache entries`);
      }
    } catch (error) {
      console.error('❌ Listings cache invalidation error:', error);
    }
  }

  // Helper methods
  generateListingsKey(filters) {
    const filterString = Object.keys(filters)
      .sort()
      .map(key => `${key}:${filters[key]}`)
      .join('|');
    
    return `listings:${filterString || 'all'}`;
  }

  async getStats() {
    if (!this.isAvailable()) return null;
    
    try {
      const info = await this.redis.info('memory');
      const keyspace = await this.redis.info('keyspace');
      
      return {
        memory: info,
        keyspace: keyspace,
        connected: this.isAvailable()
      };
    } catch (error) {
      console.error('❌ Redis stats error:', error);
      return null;
    }
  }
}

// Create singleton instance
const cacheService = new CacheService();

export default cacheService;
