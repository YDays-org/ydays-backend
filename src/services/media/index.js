import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import cors from "cors";
import multer from "multer";
import mediaRouter from "./routes.js";

const mediaApp = express();

mediaApp.use(helmet());
mediaApp.use(cookieParser());
mediaApp.use(express.urlencoded({ extended: true }));
mediaApp.use(express.json());

mediaApp.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

mediaApp.get("/", (_, res) => {
  res.status(200).json({
    message: "media service is healthy",
    timestamp: new Date().toISOString(),
  });
});

mediaApp.use("/", mediaRouter);

// Global Error Handler
mediaApp.use((error, req, res, next) => {
  console.error("Global Error Handler caught:", error);

  // Handle errors from Multer specifically
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ success: false, error: `File upload error: ${error.message}` });
  }

  // Handle custom errors (e.g., from fileFilter)
  if (error.message.includes('Invalid file type')) {
    return res.status(400).json({ success: false, error: error.message });
  }

  // Fallback for any other errors
  res.status(500).json({ success: false, error: 'An internal server error occurred.' });
});

export { mediaApp };