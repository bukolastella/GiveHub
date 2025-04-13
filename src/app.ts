import express from "express";
import { globalErrorHandler } from "./controllers/errorController";
import {
  facebookAuth,
  googleAuth,
  loginAdmin,
  oAuthFacebook,
  oAuthGoogle,
} from "./controllers/authController";
import passport from "passport";
import { Strategy as FacebookStrategy } from "passport-facebook";
import {
  createDonation,
  donationStripeWebhook,
} from "./controllers/donationController";
import "./utils/cron";
import { usersRouter } from "./routes/userRoutes";
import { campaignRouter } from "./routes/campaignRoutes";
import { donationsRouter } from "./routes/donationsRoutes";

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

// Auth
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

// Admin
app.post("/api/v1/admins/login", loginAdmin);

// routes
app.use("/api/v1/users", usersRouter);
app.use("/api/v1/campaign", campaignRouter);
app.use("/api/v1/donation", donationsRouter);

app.all(/(.*)/, (req, res, next) => {
  res.status(404).json({
    status: "fail",
    message: `${req.originalUrl} not found.`,
  });

  next();
});

app.use(globalErrorHandler);
