import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import cors from "cors";
import bookingRouter, { webhookRouter } from "./routes.js";

const bookingApp = express();

bookingApp.use("/webhooks", webhookRouter);

bookingApp.use(helmet());
bookingApp.use(cookieParser());
bookingApp.use(express.urlencoded({ extended: true }));
bookingApp.use(express.json());

bookingApp.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

bookingApp.get("/", (req, res) => {
  res.status(200).json({
    message: "booking service is healthy",
    timestamp: new Date().toISOString(),
  });
});

bookingApp.use("/", bookingRouter);

export { bookingApp };