import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import cors from "cors";
import catalogRouter from "./routes.js";

const catalogApp = express();

catalogApp.use(helmet());
catalogApp.use(cookieParser());
catalogApp.use(express.urlencoded({ extended: true }));
catalogApp.use(express.json());

catalogApp.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

catalogApp.get("/", (req, res) => {
  res.status(200).json({
    message: "catalog service is healthy",
    timestamp: new Date().toISOString(),
  });
});

catalogApp.use("/", catalogRouter);

export { catalogApp };