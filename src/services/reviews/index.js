import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import cors from "cors";
import reviewRouter from "./routes.js";

const reviewApp = express();

reviewApp.use(helmet());
reviewApp.use(cookieParser());
reviewApp.use(express.urlencoded({ extended: true }));
reviewApp.use(express.json());

reviewApp.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

reviewApp.get("/", (req, res) => {
  res.status(200).json({
    message: "review service is healthy",
    timestamp: new Date().toISOString(),
  });
});

reviewApp.use("/", reviewRouter);

export { reviewApp };