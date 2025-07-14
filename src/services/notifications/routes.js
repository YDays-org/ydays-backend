import { Router } from "express";
import { validationMiddleware } from "../../common/middlewares/validation.js";
import * as notificationHandlers from "./handlers.js";
import * as notificationSchemas from "./validation.js";
import { authMiddleware } from "../../common/middlewares/auth.js";

const router = Router();

router.use(authMiddleware);

router.get(
  "/all",
  validationMiddleware(notificationSchemas.getNotificationsSchema),
  notificationHandlers.getNotifications
);

router.patch(
  "/:id/read",
  validationMiddleware(notificationSchemas.notificationIdParamSchema),
  notificationHandlers.markAsRead
);

export default router;
