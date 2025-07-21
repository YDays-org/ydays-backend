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

const app = express();

// Load and expand environment variables
const envConfig = dotenv.config();
dotenvExpand.expand(envConfig);

app.use(helmet());
app.use(
  cors({
    origin: '*',
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
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

server.listen(process.env.SERVER_PORT || 3000, () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${process.env.SERVER_PORT}`);
  if (process.env.NODE_ENV === "development") {
    console.log(`➜ Local: ${process.env.DEV_SERVER_URL}`);
  }
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