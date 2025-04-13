import express from "express";
import { restrictTo, userProtect } from "../controllers/authController";
import {
  createDonation,
  donationPaystackInitialize,
  donationStripeInitialize,
  getAllDonation,
  getDonation,
  preValidateDonation,
  verifyPaystackDonation,
} from "../controllers/donationController";

export const donationsRouter = express.Router();

donationsRouter
  .route("/")
  .get(userProtect, restrictTo("user", "admin"), getAllDonation);

donationsRouter.route("/:id").get(userProtect, restrictTo("user"), getDonation);

donationsRouter.post(
  "/paystack/initialize",
  userProtect,
  restrictTo("user"),
  preValidateDonation,
  donationPaystackInitialize
);
donationsRouter.post(
  "/paystack",
  userProtect,
  restrictTo("user"),
  verifyPaystackDonation,
  createDonation
);

donationsRouter.post(
  "/stripe/initialize",
  userProtect,
  restrictTo("user"),
  preValidateDonation,
  donationStripeInitialize
);
