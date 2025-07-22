import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.client = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: process.env.REDIS_DB || 0,
        retryDelayOnFailover: 100,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      // Event handlers
      this.client.on('connect', () => {
        console.log('✅ Redis connected successfully');
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        console.error('❌ Redis connection error:', err);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        console.log('🔌 Redis connection closed');
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        console.log('🔄 Redis reconnecting...');
      });

      // Actually connect
      await this.client.connect();
      
      return this.client;
    } catch (error) {
      console.error('❌ Failed to initialize Redis:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      console.log('✅ Redis disconnected');
    }
  }

  getClient() {
    if (!this.isConnected || !this.client) {
      throw new Error('Redis client is not connected');
    }
    return this.client;
  }

  isReady() {
    return this.isConnected && this.client;
  }
}

// Create singleton instance
const redisService = new RedisService();

export default redisService;
