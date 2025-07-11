import { Router } from "express";
import { validationMiddleware } from "../../common/middlewares/validation.js";
import { roleCheck } from "../../common/middlewares/roles.js";
import * as reviewHandlers from "./handlers.js";
import * as reviewSchemas from "./validation.js";
import { authMiddleware } from "../../common/middlewares/auth.js";

const router = Router();

router.get(
  "/",
  validationMiddleware(reviewSchemas.getReviewsSchema),
  reviewHandlers.getReviewsForListing
);

// router.use(authMiddleware);

router.post(
  "/",
  validationMiddleware(reviewSchemas.createReviewSchema),
  reviewHandlers.submitReview
);

router.put(
  "/:id/reply",
  roleCheck(["PARTNER"]),
  validationMiddleware(reviewSchemas.addReplySchema),
  reviewHandlers.addPartnerReply
);

export default router;
