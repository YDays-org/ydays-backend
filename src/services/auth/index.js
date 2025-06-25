import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRouter from "./routes.js";

const authApp = express();

authApp.use(helmet());
authApp.use(cookieParser());
authApp.use(express.urlencoded({ extended: true }));
authApp.use(express.json());

authApp.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

authApp.get("/", (req, res) => {
  res.status(200).json({
    message: "Auth service is healthy",
    timestamp: new Date().toISOString(),
  });
});

authApp.use("/", authRouter);

export { authApp };