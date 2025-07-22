import { Router } from "express";
import backupService from "./backup-service.js";
import cacheService from "./cache-service.js";

const backupRouter = Router();

// Backup endpoints
backupRouter.post("/listings", async (req, res) => {
  try {
    const backupKey = await backupService.backupAllListings();
    res.status(200).json({
      success: true,
      message: "Listings backup completed",
      backupKey
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to backup listings",
      error: error.message
    });
  }
});

backupRouter.post("/users", async (req, res) => {
  try {
    const backupKey = await backupService.backupAllUsers();
    res.status(200).json({
      success: true,
      message: "Users backup completed",
      backupKey
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to backup users",
      error: error.message
    });
  }
});

backupRouter.post("/bookings", async (req, res) => {
  try {
    const backupKey = await backupService.backupAllBookings();
    res.status(200).json({
      success: true,
      message: "Bookings backup completed",
      backupKey
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to backup bookings",
      error: error.message
    });
  }
});

backupRouter.post("/critical", async (req, res) => {
  try {
    const backupKey = await backupService.backupCriticalData();
    res.status(200).json({
      success: true,
      message: "Critical data backup completed",
      backupKey
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to backup critical data",
      error: error.message
    });
  }
});

// Restore endpoints
backupRouter.post("/restore-listings", async (req, res) => {
  try {
    const data = await backupService.restoreListings();
    res.status(200).json({
      success: true,
      message: "Listings restored from backup",
      count: data.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to restore listings",
      error: error.message
    });
  }
});

backupRouter.post("/restore-critical", async (req, res) => {
  try {
    const data = await backupService.restoreCriticalData();
    res.status(200).json({
      success: true,
      message: "Critical data restored from backup",
      data: {
        listings: data.listings.count,
        users: data.users.count,
        bookings: data.bookings.count,
        categories: data.categories.count
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to restore critical data",
      error: error.message
    });
  }
});

// Automated backup control
backupRouter.post("/auto-start", async (req, res) => {
  try {
    const { intervalHours = 6 } = req.body;
    backupService.startAutomatedBackup(intervalHours);
    res.status(200).json({
      success: true,
      message: `Automated backup started (every ${intervalHours} hours)`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to start automated backup",
      error: error.message
    });
  }
});

backupRouter.post("/auto-stop", async (req, res) => {
  try {
    backupService.stopAutomatedBackup();
    res.status(200).json({
      success: true,
      message: "Automated backup stopped"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to stop automated backup",
      error: error.message
    });
  }
});

// Status and management endpoints
backupRouter.get("/backups", async (req, res) => {
  try {
    const backups = await backupService.listAllBackups();
    res.status(200).json({
      success: true,
      data: backups
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to list backups",
      error: error.message
    });
  }
});

backupRouter.get("/stats", async (req, res) => {
  try {
    const stats = await backupService.getBackupStats();
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get backup stats",
      error: error.message
    });
  }
});

// Cache management endpoints
backupRouter.delete("/cache-flush", async (req, res) => {
  try {
    await cacheService.flush();
    res.status(200).json({
      success: true,
      message: "Cache flushed successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to flush cache",
      error: error.message
    });
  }
});

backupRouter.get("/cache-stats", async (req, res) => {
  try {
    const stats = await cacheService.getStats();
    res.status(200).json({
      success: true,
      data: stats,
      available: cacheService.isAvailable()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get cache stats",
      error: error.message
    });
  }
});

export { backupRouter };
