import express from "express";
import http from "node:http";
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import apiServices from "./services/index.js";
import prisma from "./lib/prisma.js";
import { initializeSocket } from "./config/socket.js";
import { arcjetMiddleware } from "./common/middlewares/arcjet.js";
import backupService from "./services/cache/backup-service.js";

const app = express();

// Load and expand environment variables
const envConfig = dotenv.config();
dotenvExpand.expand(envConfig);

app.use(helmet());
app.use(
  cors({
    origin: true, // Allow all origins in development
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    optionsSuccessStatus: 200,
  })
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());
// app.use(arcjetMiddleware);

app.use("/api", apiServices);

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Main app is running and healthy",
    timestamp: new Date().toISOString(),
  });
});

const server = http.createServer(app);
initializeSocket(server);

// Initialize backup service
backupService.initialize().catch(console.error);

server.listen(5000, '0.0.0.0', async () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port 5000`);
  console.log(`➜ Local: http://localhost:5000`);
  console.log(`➜ Network: http://0.0.0.0:5000`);
  console.log(`➜ Android Emulator: http://10.0.2.2:5000`);
  
  // Start automated backup (optional - every 6 hours)
  // backupService.startAutomatedBackup(6);
});

const gracefulShutdown = async (signal) => {
  console.log(`\n🚨 Received ${signal}. Shutting down gracefully...`);

  // 1. Stop the server from accepting new connections
  server.close(async () => {
    console.log("✅ HTTP server closed.");

    // 2. Disconnect from the database
    try {
      await prisma.$disconnect();
      console.log("✅ Prisma Client disconnected.");
    } catch (e) {
      console.error("Error during Prisma disconnection:", e);
    } finally {
      process.exit(0);
    }
  });
};

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));