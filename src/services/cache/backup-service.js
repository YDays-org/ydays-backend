import cacheService from './cache-service.js';
import prisma from '../../lib/prisma.js';

class BackupService {
  constructor() {
    this.backupInterval = null;
    this.isRunning = false;
  }

  async initialize() {
    try {
      await cacheService.initialize();
      console.log('✅ Backup service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize backup service:', error);
    }
  }

  // Manual backup operations
  async backupAllListings() {
    try {
      console.log('📦 Starting listings backup...');
      
      const listings = await prisma.listing.findMany({
        include: {
          partner: true,
          category: true,
          media: true,
          schedules: true,
          amenities: {
            include: {
              amenity: true
            }
          }
        }
      });

      const backupKey = await cacheService.backupData('listings', {
        data: listings,
        count: listings.length,
        timestamp: new Date(),
        type: 'full_listings_backup'
      });

      console.log(`✅ Backed up ${listings.length} listings with key: ${backupKey}`);
      return backupKey;
    } catch (error) {
      console.error('❌ Listings backup failed:', error);
      throw error;
    }
  }

  async backupAllUsers() {
    try {
      console.log('📦 Starting users backup...');
      
      const users = await prisma.user.findMany({
        include: {
          partner: true,
          bookings: true
        }
      });

      const backupKey = await cacheService.backupData('users', {
        data: users,
        count: users.length,
        timestamp: new Date(),
        type: 'full_users_backup'
      });

      console.log(`✅ Backed up ${users.length} users with key: ${backupKey}`);
      return backupKey;
    } catch (error) {
      console.error('❌ Users backup failed:', error);
      throw error;
    }
  }

  async backupAllBookings() {
    try {
      console.log('📦 Starting bookings backup...');
      
      const bookings = await prisma.booking.findMany({
        include: {
          user: true,
          listing: true,
          schedule: true,
          payment: true
        }
      });

      const backupKey = await cacheService.backupData('bookings', {
        data: bookings,
        count: bookings.length,
        timestamp: new Date(),
        type: 'full_bookings_backup'
      });

      console.log(`✅ Backed up ${bookings.length} bookings with key: ${backupKey}`);
      return backupKey;
    } catch (error) {
      console.error('❌ Bookings backup failed:', error);
      throw error;
    }
  }

  async backupCriticalData() {
    try {
      console.log('📦 Starting critical data backup...');
      
      const [listings, users, bookings, categories] = await Promise.all([
        prisma.listing.findMany({
          include: {
            partner: true,
            category: true,
            schedules: true
          }
        }),
        prisma.user.findMany({
          include: {
            partner: true
          }
        }),
        prisma.booking.findMany({
          include: {
            user: true,
            listing: true,
            payment: true
          }
        }),
        prisma.category.findMany()
      ]);

      const criticalData = {
        listings: { data: listings, count: listings.length },
        users: { data: users, count: users.length },
        bookings: { data: bookings, count: bookings.length },
        categories: { data: categories, count: categories.length },
        timestamp: new Date(),
        type: 'critical_data_backup'
      };

      const backupKey = await cacheService.backupData('critical', criticalData);

      console.log(`✅ Critical data backup completed with key: ${backupKey}`);
      console.log(`   - ${listings.length} listings`);
      console.log(`   - ${users.length} users`);
      console.log(`   - ${bookings.length} bookings`);
      console.log(`   - ${categories.length} categories`);

      return backupKey;
    } catch (error) {
      console.error('❌ Critical data backup failed:', error);
      throw error;
    }
  }

  // Restore operations
  async restoreListings() {
    try {
      console.log('🔄 Restoring listings from backup...');
      
      const backup = await cacheService.getBackup('listings');
      if (!backup) {
        throw new Error('No listings backup found');
      }

      console.log(`📥 Found backup with ${backup.count} listings from ${backup.timestamp}`);
      return backup.data;
    } catch (error) {
      console.error('❌ Listings restore failed:', error);
      throw error;
    }
  }

  async restoreCriticalData() {
    try {
      console.log('🔄 Restoring critical data from backup...');
      
      const backup = await cacheService.getBackup('critical');
      if (!backup) {
        throw new Error('No critical data backup found');
      }

      console.log(`📥 Found critical backup from ${backup.timestamp}`);
      console.log(`   - ${backup.listings.count} listings`);
      console.log(`   - ${backup.users.count} users`);
      console.log(`   - ${backup.bookings.count} bookings`);
      console.log(`   - ${backup.categories.count} categories`);

      return backup;
    } catch (error) {
      console.error('❌ Critical data restore failed:', error);
      throw error;
    }
  }

  // Automated backup scheduling
  startAutomatedBackup(intervalHours = 6) {
    if (this.isRunning) {
      console.log('⚠️ Automated backup is already running');
      return;
    }

    const intervalMs = intervalHours * 60 * 60 * 1000;
    
    this.backupInterval = setInterval(async () => {
      try {
        console.log('🤖 Starting automated backup...');
        await this.backupCriticalData();
        console.log('✅ Automated backup completed');
      } catch (error) {
        console.error('❌ Automated backup failed:', error);
      }
    }, intervalMs);

    this.isRunning = true;
    console.log(`✅ Automated backup started (every ${intervalHours} hours)`);
  }

  stopAutomatedBackup() {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
      this.isRunning = false;
      console.log('🛑 Automated backup stopped');
    }
  }

  // Backup management
  async listAllBackups() {
    try {
      const [listings, users, bookings, critical] = await Promise.all([
        cacheService.listBackups('listings'),
        cacheService.listBackups('users'),
        cacheService.listBackups('bookings'),
        cacheService.listBackups('critical')
      ]);

      return {
        listings,
        users,
        bookings,
        critical,
        total: listings.length + users.length + bookings.length + critical.length
      };
    } catch (error) {
      console.error('❌ Failed to list backups:', error);
      return null;
    }
  }

  async getBackupStats() {
    try {
      const backups = await this.listAllBackups();
      const cacheStats = await cacheService.getStats();

      return {
        backups,
        cache: cacheStats,
        service: {
          isRunning: this.isRunning,
          automatedBackup: !!this.backupInterval
        }
      };
    } catch (error) {
      console.error('❌ Failed to get backup stats:', error);
      return null;
    }
  }
}

// Create singleton instance
const backupService = new BackupService();

export default backupService;
