import { Router } from "express";
import { validationMiddleware } from "../../common/middlewares/validation.js";
import { roleCheck } from "../../common/middlewares/roles.js";
import * as reviewHandlers from "./handlers.js";
import * as reviewSchemas from "./validation.js";

const router = Router();

router.get(
  "/",
  validationMiddleware(reviewSchemas.getReviewsSchema),
  reviewHandlers.getReviewsForListing
);

router.post(
  "/",
  validationMiddleware(reviewSchemas.createReviewSchema),
  reviewHandlers.submitReview
);

router.put(
  "/:id/reply",
  roleCheck(["partner"]),
  validationMiddleware(reviewSchemas.addReplySchema),
  reviewHandlers.addPartnerReply
);

export default router;
