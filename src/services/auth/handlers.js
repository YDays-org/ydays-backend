import prisma from "../../lib/prisma.js";
import admin from "../../config/firebase.js";
import { sendMail } from "../../lib/email.js";

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

    await admin.auth().setCustomUserClaims(userRecord.uid, { role: "CUSTOMER" });

    const newUser = await prisma.user.create({
      data: {
        id: userRecord.uid,
        email,
        fullName,
        role: "CUSTOMER",
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
    const resetLink = await admin.auth().generatePasswordResetLink(email);
    await sendMail({
      to: email,
      subject: "Your Password Reset Request",
      html: `
        <h1>Password Reset</h1>
        <p>You requested a password reset. Please click the link below to set a new password:</p>
        <a href="${resetLink}" target="_blank">Reset Password</a>
        <p>This link will expire in 1 hour. If you did not request this, please ignore this email.</p>
      `,
    });
    res.status(200).json({ success: true, message: `If an account with ${email} exists, a password reset link has been sent.` });
  } catch (error) {
    // Do not reveal if the email exists or not for security reasons.
    console.error("Password reset request failed:", error);
    res.status(200).json({ success: true, message: `If an account with ${email} exists, a password reset link has been sent.` });
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