import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import cors from "cors";
import partnerRouter from "./routes.js";

const partnerApp = express();

partnerApp.use(helmet());
partnerApp.use(cookieParser());
partnerApp.use(express.urlencoded({ extended: true }));
partnerApp.use(express.json());

partnerApp.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

partnerApp.get("/", (req, res) => {
  res.status(200).json({
    message: "Partner service is healthy",
    timestamp: new Date().toISOString(),
  });
});

partnerApp.use("/", partnerRouter);

export { partnerApp }; 