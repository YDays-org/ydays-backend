import nodemailer from "nodemailer";
import Joi from "joi";

const mailOptionsSchema = Joi.object({
  to: Joi.string().email().required(),
  subject: Joi.string().min(1).required(),
  html: Joi.string().min(1).required(),
  attachments: Joi.array().items(Joi.object()).optional(),
}).options({ stripUnknown: true });

/**
 * Sends an email using Nodemailer with Gmail.
 * @param {object} mailOptions - The options for the email.
 * @param {string} mailOptions.to - Recipient's email address.
 * @param {string} mailOptions.subject - Email subject.
 * @param {string} mailOptions.html - HTML content of the email.
 */
export const sendMail = async (mailOptions) => {
  const { error, value: validatedOptions } = mailOptionsSchema.validate(mailOptions);
  if (error) {
    throw new Error(`Invalid mail options: ${error.message}`);
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.MAILING_EMAIL,
      pass: process.env.MAILING_PASSWORD,
    },
  });

  try {
    await transporter.sendMail({
      from: '"Casablanca Reservations" <no-reply@CasablancaReservations.com>',
      ...validatedOptions,
    });
    console.log(`Email sent successfully to ${validatedOptions.to}`);
  } catch (emailError) {
    console.error(`Failed to send email to ${validatedOptions.to}:`, emailError);
  }
};