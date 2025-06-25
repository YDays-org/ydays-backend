import { Router } from "express";
import * as mediaHandlers from "./handlers.js";
import * as mediaSchemas from "./validation.js";
import { uploadMiddleware } from "./middlewares.js";
import { validationMiddleware } from "../../common/middlewares/validation.js";

const router = Router();

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
