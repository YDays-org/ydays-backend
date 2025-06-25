import prisma from "../../lib/prisma.js";
import admin from "../../config/firebase.js";

export const signUp = async (req, res) => {
  const { email, password, fullName, phoneNumber } = req.body;
  let userRecord = null; // Keep track of the created Firebase user

  try {
    userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: fullName,
      phoneNumber,
    });

    await admin.auth().setCustomUserClaims(userRecord.uid, { role: "customer" });

    const newUser = await prisma.user.create({
      data: {
        id: userRecord.uid,
        email,
        fullName,
        role: "customer",
        phoneNumber,
        email_verified: false, // Set initial state
        phone_verified: false,
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
    // ROLLBACK: If any step fails after Firebase user creation, delete the orphaned Firebase user.
    if (userRecord) {
      await admin.auth().deleteUser(userRecord.uid);
      console.log(`Orphaned Firebase user ${userRecord.uid} deleted due to registration error.`);
    }

    if (error.code === 'auth/email-already-exists') {
      return res.status(409).json({ success: false, error: 'This email address is already in use.' });
    }

    console.error("User registration failed:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred during registration.", details: error.message });
  }
};

export const getProfile = async (req, res) => {
  // No database call needed here anymore! The enhanced middleware already did it.
  // The full, trusted user object is available on req.user.
  res.status(200).json({ success: true, user: req.user });
};

export const signIn = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await prisma.user.findUnique({
      where: { email: email },
      include: { partner: true },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    res.status(200).json({
      success: true,
      message: "Login successful",
    });
  } catch (error) {
    res.status(401).json({ success: false, message: "Invalid Firebase ID token.", error: error.message });
  }
};

export const updateProfile = async (req, res) => {
  const { fullName, phoneNumber, profilePictureUrl, companyName, companyAddress, websiteUrl, socialMediaLinks } = req.body;

  try {
    const userUpdateData = {
      fullName,
      phoneNumber,
      profilePictureUrl,
    };

    // Filter out undefined values
    Object.keys(userUpdateData).forEach((key) => userUpdateData[key] === undefined && delete userUpdateData[key]);

    // Start a transaction
    const finalUser = await prisma.$transaction(async (tx) => {
      // Update the user
      await tx.user.update({
        where: { id: req.user.id },
        data: userUpdateData,
      });

      // If the user is a partner, update partner-specific fields
      if (req.user.role === "partner") {
        const partnerUpdateData = {
          companyName,
          companyAddress,
          websiteUrl,
          socialMediaLinks,
        };
        Object.keys(partnerUpdateData).forEach((key) => partnerUpdateData[key] === undefined && delete partnerUpdateData[key]);

        if (Object.keys(partnerUpdateData).length > 0) {
          await tx.partner.update({
            where: { userId: req.user.id },
            data: partnerUpdateData,
          });
        }
      }

      // Fetch the final, updated user with partner info
      return tx.user.findUnique({
        where: { id: req.user.id },
        include: { partner: true },
      });
    });

    res.status(200).json({ success: true, message: "Profile updated successfully.", user: finalUser });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update profile.", error: error.message });
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

    await admin.auth().deleteUser(id);
    res.status(200).json({ success: true, message: "Account deleted successfully." });
  } catch (error) {
    console.error(`Failed to delete Firebase user ${id} after DB deletion. Requires manual cleanup.`, error);
    res.status(500).json({ success: false, error: "Failed to delete account." });
  }
};