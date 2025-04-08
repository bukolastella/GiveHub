import express from "express";
import { globalErrorHandler } from "./controllers/errorController";
import {
  createUser,
  deleteUserAccount,
  forgotPassword,
  getUserProfile,
  loginUser,
  resetPassword,
  updatePassword,
  verifyEmail,
} from "./controllers/userController";
import {
  facebookAuth,
  googleAuth,
  oAuthFacebook,
  oAuthGoogle,
  userProtect,
} from "./controllers/authController";
import passport from "passport";
import { Strategy as FacebookStrategy } from "passport-facebook";

export const app = express();
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
app.post("/api/v1/users/update-password", userProtect, updatePassword);
app.get("/api/v1/users/profile", userProtect, getUserProfile);
app.post("/api/v1/users/delete-account", userProtect, deleteUserAccount);
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
app.all(/(.*)/, (req, res, next) => {
  res.status(404).json({
    status: "fail",
    message: `${req.originalUrl} not found.`,
  });

  next();
});

app.use(globalErrorHandler);
