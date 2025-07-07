import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRouter from "./api/routes.js";

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

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Auth service is healthy",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRouter);

app.listen(PORT, () => {
  console.log(`Auth service running on http://localhost:${PORT}`);
});