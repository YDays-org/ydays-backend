import Joi from "joi";
import JoiPhoneNumber from "joi-phone-number";

const CustomJoi = Joi.extend(JoiPhoneNumber);

export const signUpSchema = {
  body: Joi.object({
    email: Joi.string().email().required(),
    fullName: Joi.string().min(3).required(),
    password: Joi.string().min(8).required(),
    phoneNumber: CustomJoi.string().phoneNumber({
      defaultCountry: "MA",
      format: 'e164',
      strict: true,
    }).required(),
  }),
};

export const updateProfileSchema = {
  body: Joi.object({
    fullName: Joi.string().min(3),
    phoneNumber: CustomJoi.string().phoneNumber({
      defaultCountry: "MA",
      format: 'e164',
      strict: false,
    }).allow(null, ''),
    profilePictureUrl: Joi.string().uri().allow(null, ''),
    // For partners
    companyName: Joi.string(),
    companyAddress: Joi.string(),
    websiteUrl: Joi.string().uri().allow(null, ''),
    socialMediaLinks: Joi.object(),
  }).min(1)
};

// Schema for requesting a password reset email
export const requestPasswordResetSchema = {
  body: Joi.object({
    email: Joi.string().email().required(),
  }),
};

// Schema for changing the password while logged in
export const changePasswordSchema = {
  body: Joi.object({
    newPassword: Joi.string().min(6).required(),
  }),
};