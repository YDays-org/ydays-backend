// common/middlewares/auth.js (CORRECTED)
import admin from "../../config/firebase.js";
import prisma from "../../lib/prisma.js"; 

export const authMiddleware = async (req, res, next) => {
  console.log('authMiddleware called for:', req.method, req.path);
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log('authMiddleware: No valid authorization header');
    return res.status(401).json({ message: "Unauthorized: No token provided." });
  }

  const idToken = authHeader.split(" ")[1];
  console.log('authMiddleware: Token found, verifying...');

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    console.log('authMiddleware: Token verified for user:', decodedToken.uid);

    const dbUser = await prisma.user.findUnique({
      where: { id: decodedToken.uid },
      include: { partner: true },
    });

    if (!dbUser) {
      console.log('authMiddleware: User not found in database:', decodedToken.uid);
      return res.status(404).json({ message: "Authenticated user not found in the database." });
    }
    
    req.user = {
      ...dbUser, // Contains: id, email, role, fullName, partner, etc. from YOUR DB
      firebase_email_verified: decodedToken.email_verified // Add the LIVE status from Firebase
    };

    console.log('authMiddleware: User authenticated successfully:', req.user.id, 'role:', req.user.role);
    next();
  } catch (error) {
    console.error("Error verifying auth token:", error);
    return res.status(403).json({ message: "Forbidden: Invalid or expired token." });
  }
};