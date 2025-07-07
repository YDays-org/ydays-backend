import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import cors from "cors";
import catalogRouter from "./api/routes.js";

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
    message: "Catalog service is healthy",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/catalog", catalogRouter);

app.listen(PORT, () => {
  console.log(`Catalog service running on http://localhost:${PORT}`);
});