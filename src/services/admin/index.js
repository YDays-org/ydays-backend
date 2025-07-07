import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import cors from "cors";
import adminRouter from "./routes.js";

const adminApp = express();

adminApp.use(helmet());
adminApp.use(cookieParser());
adminApp.use(express.urlencoded({ extended: true }));
adminApp.use(express.json());

adminApp.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

adminApp.get("/", (req, res) => {
  res.status(200).json({
    message: "Admin service is healthy",
    timestamp: new Date().toISOString(),
  });
});

adminApp.use("/", adminRouter);

export { adminApp }; 