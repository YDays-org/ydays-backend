import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import cors from "cors";
import multer from "multer";
import mediaRouter from "./api/routes.js";

const app = express();
const PORT = process.env.SERVER_PORT || 3000;

app.use(helmet());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

app.get("/", (_, res) => {
  res.status(200).json({
    message: "Media service is healthy",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/media", mediaRouter);

// Global Error Handler
app.use((error, req, res, next) => {
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

app.listen(PORT, () => {
  console.log(`Media service running on http://localhost:${PORT}`);
});