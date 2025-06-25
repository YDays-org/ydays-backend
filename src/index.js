import express from "express";
import { Server } from "socket.io";
import http from "node:http";
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import apiServices from "./services/index.js";
import prisma from "./lib/prisma.js";

const app = express();

// Load and expand environment variables
const envConfig = dotenv.config();
dotenvExpand.expand(envConfig);

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*',
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  })
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());

app.use("/api", apiServices);

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Main app is running and healthy",
    timestamp: new Date().toISOString(),
  });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*',
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  },
});

// used to store online users
const userSocketMap = {};

io.on("connection", (socket) => {
  console.log("A user connected", socket.id);

  const userId = socket.handshake.query.userId;
  if (userId) {
    userSocketMap[userId] = socket.id;
    console.log(`User ${userId} connected with socket ${socket.id}`);
  }

  // io.emit() is used to send events to all the connected clients
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  socket.on("disconnect", () => {
    console.log("A user disconnected", socket.id);
    if (userId) {
      delete userSocketMap[userId];
      io.emit("getOnlineUsers", Object.keys(userSocketMap));
    }
  });
});

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


export default server;