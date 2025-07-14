import { Router } from "express";
import { authApp } from "./auth/index.js";
import { catalogApp } from "./catalog/index.js";
import { bookingApp } from "./booking/index.js";
import { reviewApp } from "./reviews/index.js";
import { mediaApp } from "./media/index.js";
import { notificationApp } from "./notifications/index.js";
import { partnerApp } from "./partner/index.js";
import { adminApp } from "./admin/index.js";

const apiRouter = Router();

apiRouter.get("/", (req, res) => {
  res.status(200).json({
    message: "Services api is running and healthy",
    timestamp: new Date().toISOString(),
  });
});

apiRouter.use("/auth", authApp);
apiRouter.use("/partner", partnerApp);
apiRouter.use("/admin", adminApp);
apiRouter.use("/catalog", catalogApp);
apiRouter.use("/booking", bookingApp);
apiRouter.use("/reviews", reviewApp);
apiRouter.use("/media", mediaApp);
apiRouter.use("/notifications", notificationApp);

export default apiRouter; 