import prisma from "../lib/prisma.js";

/**
 * Checks if a user's email is verified. MUST run AFTER authMiddleware.
 * It first checks the live status from Firebase. If verified, it then
 * syncs this status to the local database if it's out of date.
 */
export const requireEmailVerification = async (req, res, next) => {
  const { id, email_verified: dbEmailVerified, firebase_email_verified: firebaseEmailVerified } = req.user;

  if (!firebaseEmailVerified) {
    return res.status(403).json({
      success: false,
      error: "Forbidden: Your email address must be verified to perform this action.",
      code: "EMAIL_NOT_VERIFIED",
    });
  }

  if (firebaseEmailVerified && !dbEmailVerified) {
    try {
      await prisma.user.update({
        where: { id },
        data: { email_verified: true },
      });
      console.log(`Synced email verification status for user ${id}.`);
    } catch (error) {

      console.error(`Failed to sync email verification status for user ${id}:`, error);
    }
  }

  next();
};