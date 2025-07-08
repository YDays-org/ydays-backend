import { Router } from "express";
import * as mediaHandlers from "./handlers.js";
import * as mediaSchemas from "./validation.js";
import { uploadMiddleware } from "./middlewares.js";
import {
  validationMiddleware,
  authMiddleware,
  roleCheck,
} from "@casablanca/common";

const router = Router();

router.use(authMiddleware);
router.use(roleCheck(["PARTNER"]));

router.post(
  "/upload/multiple",
  uploadMiddleware.array("media", 7),
  validationMiddleware(mediaSchemas.uploadMedia),
  mediaHandlers.uploadMultipleMedia
);

router.post(
  "/upload/single",
  uploadMiddleware.single("media"),
  validationMiddleware(mediaSchemas.uploadMedia),
  mediaHandlers.uploadSingleMedia
);

export default router;
