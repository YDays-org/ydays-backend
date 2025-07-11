import prisma from "../../lib/prisma.js";
import admin from "../../config/firebase.js";
import { sendMail } from "../../lib/email.js";
import { UserRole } from "@prisma/client";

export const signUp = async (req, res) => {
  const { email, password, fullName, phoneNumber } = req.body;

  let userRecord = null; 

  try {
    const existingUserInDb = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUserInDb) {
      return res.status(409).json({ success: false, error: 'This email address is already in use.' });
    }

    userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: fullName,
      phoneNumber,
    });

    await admin.auth().setCustomUserClaims(userRecord.uid, { role: UserRole.CUSTOMER });

    const newUser = await prisma.user.create({
      data: {
        id: userRecord.uid,
        email,
        fullName,
        role: UserRole.customer,
        phoneNumber,
        emailVerified: false, // Set initial state
        phoneVerified: false,
      },
    });

    const verificationLink = await admin.auth().generateEmailVerificationLink(email);
    await sendMail({
      to: email,
      subject: "Welcome! Please Verify Your Email",
      html: `
        <h1>Welcome to Our App!</h1>
        <p>Thank you for signing up. Please click the link below to verify your email address:</p>
        <a href="${verificationLink}" target="_blank">Verify Email</a>
        <p>If you did not sign up for this account, you can safely ignore this email.</p>
      `,
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully. A verification email has been sent.",
      user: newUser,
    });

  } catch (error) {
    if (userRecord) {
      try {
        await admin.auth().deleteUser(userRecord.uid);
        console.log(`Successfully rolled back orphaned Firebase user ${userRecord.uid}.`);
      } catch (rollbackError) {
        console.error(
          `CRITICAL ERROR: Failed to create Prisma user and ALSO failed to roll back Firebase user ${userRecord.uid}. MANUAL CLEANUP REQUIRED.`,
          rollbackError
        );
      }
    }

    // Handle known errors cleanly
    if (error.code === 'auth/email-already-exists') {
      return res.status(409).json({ success: false, error: 'This email address is already in use by Firebase.' });
    }
    if (error.code === 'P2002') { // Prisma's unique constraint violation code
      return res.status(409).json({ success: false, error: 'This email address is already in use.' });
    }

    console.error("An unexpected error occurred during user registration:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred during registration." });
  }
};

export const getProfile = async (req, res) => {
  // No database call needed here anymore! The enhanced middleware already did it.
  // The full, trusted user object is available on req.user.
  res.status(200).json({ success: true, user: req.user });
};

export const updateProfile = async (req, res) => {
  const { id: userId, role } = req.user;

  try {
    const allowedUserUpdates = {
      fullName: req.body.fullName,
      profilePictureUrl: req.body.profilePictureUrl,
      phoneNumber: req.body.phoneNumber,
      // OMIT email, phoneNumber, and role for customer.
    };

    // Filter out any undefined values so we don't overwrite existing fields with null
    Object.keys(allowedUserUpdates).forEach(key => allowedUserUpdates[key] === undefined && delete allowedUserUpdates[key]);

    const finalUser = await prisma.$transaction(async (tx) => {
      if (Object.keys(allowedUserUpdates).length > 0) {
        await tx.user.update({
          where: { id: userId },
          data: allowedUserUpdates,
        });
      }

      // If the user has the 'partner' role, update their partner info
      if (role === "PARTNER") {
        const allowedPartnerUpdates = {
          companyName: req.body.companyName,
          companyAddress: req.body.companyAddress,
          websiteUrl: req.body.websiteUrl,
          socialMediaLinks: req.body.socialMediaLinks,
        };
        Object.keys(allowedPartnerUpdates).forEach(key => allowedPartnerUpdates[key] === undefined && delete allowedPartnerUpdates[key]);

        if (Object.keys(allowedPartnerUpdates).length > 0) {
          await tx.partner.upsert({
            where: { userId: userId },
            update: allowedPartnerUpdates,
            create: {
              userId: userId,
              ...allowedPartnerUpdates,
            },
          });
        }
      }

      return tx.user.findUnique({
        where: { id: userId },
        include: { partner: true },
      });
    });

    res.status(200).json({ success: true, message: "Profile updated successfully.", user: finalUser });
  } catch (error) {
    console.error("Profile update failed:", error);
    res.status(500).json({ success: false, error: "Failed to update profile.", details: error.message });
  }
};

export const sendVerificationEmail = async (req, res) => {
  const { email } = req.user; // Get email from authenticated user
  try {
    const verificationLink = await admin.auth().generateEmailVerificationLink(email);
    // Again, send this link via an email service in production.
    console.log(`New verification link (for dev): ${verificationLink}`);
    res.status(200).json({ success: true, message: `A new verification email has been sent to ${email}.` });
  } catch (error) {
    console.error("Failed to generate verification email:", error);
    res.status(500).json({ success: false, error: "Failed to send verification email." });
  }
};

export const requestPasswordReset = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(200).json({
        success: true,
        message: `If an account associated with ${email} exists, a password reset link has been sent.`
      });
    }

    // Get the user from Firebase to check their provider data
    try {
      const firebaseUser = await admin.auth().getUserByEmail(email);
      // Check if the user has provider data (e.g., Google, Facebook, etc.)
      const isNativeUser = firebaseUser.providerData[0].providerId === 'phone' || firebaseUser.providerData[1].providerId === 'password';

      if (!isNativeUser) {
        // User is registered with a third-party provider
        return res.status(400).json({
          success: false,
          error: `This account uses an external authentication provider (Google, Facebook, etc.). Please sign in using that method.`
        });
      }

      // Generate password reset link for native users
      const resetLink = await admin.auth().generatePasswordResetLink(email);

      // Send the reset email
      await sendMail({
        to: email,
        subject: "Reset Your Password",
        html: `
          <h1>Password Reset</h1>
          <p>You have requested a password reset. Click the link below to set a new password:</p>
          <a href="${resetLink}" target="_blank">Reset My Password</a>
          <p>This link will expire in 1 hour. If you did not request this reset, please ignore this email.</p>
        `,
      });

      return res.status(200).json({
        success: true,
        message: `A reset link has been sent to ${email}.`
      });

    } catch (firebaseError) {
      console.error("Firebase error when checking user:", firebaseError);
      // If there's an issue with Firebase but we know the user exists in our DB
      return res.status(500).json({
        success: false,
        error: "An error occurred while verifying your account. Please try again later."
      });
    }
  } catch (error) {
    // Handle any other errors
    console.error("Password reset request failed:", error);
    res.status(200).json({ success: true, message: `If an account with ${email} exists, a password reset link has been sent.` });
    return res.status(500).json({
      success: false,
      error: "An error occurred while processing your request. Please try again later."
    });
  }
};

export const changePassword = async (req, res) => {
  const { id } = req.user;
  const { newPassword } = req.body;
  try {
    await admin.auth().updateUser(id, { password: newPassword });
    res.status(200).json({ success: true, message: "Password updated successfully." });
  } catch (error) {
    console.error("Failed to change password:", error);
    res.status(500).json({ success: false, error: "Failed to update password." });
  }
};

export const deleteAccount = async (req, res) => {
  const { id } = req.user;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.delete({ where: { id } });
    });

    // This runs only if the database deletion was successful.
    await admin.auth().deleteUser(id);

    res.status(200).json({ success: true, message: "Account and all associated data deleted successfully." });
  } catch (error) {
    console.error(`Error during account deletion for user ${id}:`, error);
    console.error(`Please check if user ${id} was deleted from the database but not from Firebase.`);
    res.status(500).json({ success: false, error: "Failed to completely delete account." });
  }
};

export const syncFirebaseUser = async (req, res) => {
  try {
    // Verify the Firebase token from the request
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "No valid token provided" });
    }

    const idToken = authHeader.split(" ")[1];
    let decodedToken;

    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (error) {
      return res.status(401).json({ success: false, error: "Invalid Firebase token" });
    }

    const { uid, email, name, picture, email_verified, phone_number } = decodedToken;

    // Check if user already exists in database
    const existingUser = await prisma.user.findUnique({
      where: { id: uid },
      include: { partner: true }
    });

    let user;

    if (existingUser) {
      // Update existing user with latest Firebase data
      user = await prisma.user.update({
        where: { id: uid },
        data: {
          email: email,
          fullName: name || existingUser.fullName,
          emailVerified: email_verified || false,
          phoneNumber: phone_number || existingUser.phoneNumber,
          phoneVerified: phone_number ? true : existingUser.phoneVerified,
          profilePictureUrl: picture || existingUser.profilePictureUrl,
        },
        include: { partner: true }
      });
    } else {
      // Create new user from Firebase data
      user = await prisma.user.create({
        data: {
          id: uid,
          email: email,
          fullName: name || email.split('@')[0], // fallback to email prefix
          role: UserRole.customer, // default role
          emailVerified: email_verified || false,
          phoneNumber: phone_number || null,
          phoneVerified: phone_number ? true : false,
          profilePictureUrl: picture || null,
        },
        include: { partner: true }
      });

      // Send welcome email for new users (optional)
      if (email) {
        try {
          await sendMail({
            to: email,
            subject: "Welcome to Casablanca Découvertes!",
            html: `
              <h1>Welcome to Casablanca Découvertes!</h1>
              <p>Thank you for joining our platform. Start discovering amazing activities, events, and restaurants in Casablanca!</p>
              <p>Explore our platform and book your next adventure.</p>
            `,
          });
        } catch (emailError) {
          console.warn("Could not send welcome email:", emailError);
        }
      }
    }

    res.status(200).json({
      success: true,
      message: existingUser ? "User data synchronized successfully" : "User created and synchronized successfully",
      user: user
    });

  } catch (error) {
    console.error("Error syncing Firebase user to database:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to sync user data",
      details: error.message 
    });
  }
};