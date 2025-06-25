import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import cors from "cors";
import notificationRouter from "./routes.js";

const notificationApp = express();

notificationApp.use(helmet());
notificationApp.use(cookieParser());
notificationApp.use(express.urlencoded({ extended: true }));
notificationApp.use(express.json());

notificationApp.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

notificationApp.get("/", (req, res) => {
  res.status(200).json({
    message: "notification service is healthy",
    timestamp: new Date().toISOString(),
  });
});

notificationApp.use("/", notificationRouter);

export { notificationApp };