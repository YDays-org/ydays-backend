import admin from "../config/firebase.js";
import prisma from "../lib/prisma.js";


export const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized: No token provided." });
  }

  const idToken = authHeader.split(" ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    const dbUser = await prisma.user.findUnique({
      where: { id: decodedToken.uid },
      include: { partner: true },
    });

    if (!dbUser) {
      return res.status(404).json({ message: "Authenticated user not found in the database." });
    }

    req.user = {
      ...dbUser, // Contains: id, email, role, fullName, partner, etc. from YOUR DB
      firebase_email_verified: decodedToken.email_verified // Add the LIVE status from Firebase
    };

    next();
  } catch (error) {
    console.error("Error verifying auth token:", error);
    return res.status(403).json({ message: "Forbidden: Invalid or expired token." });
  }
};