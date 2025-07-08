import { Router } from "express";
import { validationMiddleware, authMiddleware } from "@casablanca/common";
import * as notificationHandlers from "./handlers.js";
import * as notificationSchemas from "./validation.js";

const router = Router();

router.use(authMiddleware);

router.get(
  "/",
  validationMiddleware(notificationSchemas.getNotificationsSchema),
  notificationHandlers.getNotifications
);

router.patch(
  "/:id/read",
  validationMiddleware(notificationSchemas.notificationIdParamSchema),
  notificationHandlers.markAsRead
);

export default router;
