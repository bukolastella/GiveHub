import express from "express";
import { globalErrorHandler } from "./controllers/errorController";
import {
  deleteUserAccount,
  getUserProfile,
  resizeAvatar,
  updateAvatar,
  uploadAvatar,
} from "./controllers/userController";
import {
  facebookAuth,
  googleAuth,
  loginAdmin,
  oAuthFacebook,
  oAuthGoogle,
  restrictTo,
  verifyEmail,
  updatePassword,
  userProtect,
  loginUser,
  forgotPassword,
  createUser,
  resetPassword,
} from "./controllers/authController";
import passport from "passport";
import { Strategy as FacebookStrategy } from "passport-facebook";
import {
  createCampaign,
  deleteCampaign,
  editCampaign,
  getAllCampaign,
  getCampaign,
  uploadMedias,
} from "./controllers/campaignController";
import {
  getDonation,
  getAllDonation,
  createDonation,
  donationStripeWebhook,
  donationPaystackInitialize,
  preValidateDonation,
  verifyPaystackDonation,
  donationStripeInitialize,
} from "./controllers/donationController";
import "./utils/cron";

export const app = express();

app.post(
  "/api/v1/donation/stripe/webhook",
  express.raw({ type: "application/json" }),
  donationStripeWebhook,
  createDonation
);

app.use(express.json());

passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
      callbackURL: "/api/v1/auth/facebook/callback",
      // "https://3cd0-102-89-75-143.ngrok-free.app/api/v1/auth/facebook/callback",
      profileFields: ["id", "displayName", "photos", "email", "name"],
    },
    facebookAuth
  )
);

// // Auth
app.post("/api/v1/users/signup", createUser);
app.post("/api/v1/users/verify-email", verifyEmail);
app.post("/api/v1/users/login", loginUser);
app.post("/api/v1/users/forgot-password", forgotPassword);
app.post("/api/v1/users/reset-password", resetPassword);
app.post("/api/v1/google-auth", googleAuth);
app.get("/api/v1/oauth-google", oAuthGoogle);
app.get(
  "/api/v1/auth/facebook",
  passport.authenticate("facebook", { scope: ["email"] })
);
app.get(
  "/api/v1/auth/facebook/callback",
  passport.authenticate("facebook", {
    failureRedirect: "/login",
    session: false,
  }),
  oAuthFacebook
);
//
app.post(
  "/api/v1/users/update-password",
  userProtect,
  restrictTo("user"),
  updatePassword
);
app.get(
  "/api/v1/users/profile",
  userProtect,
  restrictTo("user"),
  getUserProfile
);
app.delete(
  "/api/v1/users/delete-account",
  userProtect,
  restrictTo("user"),
  deleteUserAccount
);
app.post(
  "/api/v1/users/avatar",
  userProtect,
  restrictTo("user"),
  uploadAvatar,
  resizeAvatar,
  updateAvatar
);

// Admin
app.post("/api/v1/admins/login", loginAdmin);
app.post(
  "/api/v1/campaign",
  userProtect,
  restrictTo("admin"),
  uploadMedias,
  createCampaign
);
app.patch(
  "/api/v1/campaign/:id",
  userProtect,
  restrictTo("admin"),
  uploadMedias,
  editCampaign
);

app.get("/api/v1/campaign", getAllCampaign);
app.get("/api/v1/campaign/:id", getCampaign);
app.delete(
  "/api/v1/campaign/:id",
  userProtect,
  restrictTo("admin"),
  deleteCampaign
);

// donations
app.get("/api/v1/donation", userProtect, restrictTo("user"), getAllDonation);
app.get("/api/v1/donation/:id", userProtect, restrictTo("user"), getDonation);
app.post(
  "/api/v1/donation/paystack/initialize",
  userProtect,
  restrictTo("user"),
  preValidateDonation,
  donationPaystackInitialize
);
app.post(
  "/api/v1/donation/paystack",
  userProtect,
  restrictTo("user"),
  verifyPaystackDonation,
  createDonation
);

app.post(
  "/api/v1/donation/stripe/initialize",
  userProtect,
  restrictTo("user"),
  preValidateDonation,
  donationStripeInitialize
);

app.all(/(.*)/, (req, res, next) => {
  res.status(404).json({
    status: "fail",
    message: `${req.originalUrl} not found.`,
  });

  next();
});

app.use(globalErrorHandler);
