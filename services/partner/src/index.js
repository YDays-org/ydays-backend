import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import cors from "cors";
import partnerRouter from "./api/routes.js";

const app = express();
const PORT = process.env.SERVER_PORT || 3000;

app.use(helmet());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
}));

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Partner service is healthy",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/partner", partnerRouter);

app.listen(PORT, () => {
  console.log(`Partner service running on http://localhost:${PORT}`);
}); 