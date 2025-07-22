import { Router } from "express";
import * as mediaHandlers from "./handlers.js";
import * as mediaSchemas from "./validation.js";
import { uploadMiddleware } from "./middlewares.js";
import { validationMiddleware } from "../../common/middlewares/validation.js";
import { authMiddleware } from "../../common/middlewares/auth.js";
import { roleCheck } from "../../common/middlewares/roles.js";

const router = Router();

router.use(authMiddleware);
router.use(roleCheck(["partner"]));

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
