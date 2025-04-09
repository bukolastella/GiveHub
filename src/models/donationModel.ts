import { model, Schema } from "mongoose";
import { donationSchemaJoi } from "../utils/validation";
import AppError from "../utils/appError";

const donationSchema = new Schema({
  campaign: {
    type: Schema.ObjectId,
    ref: "Campaign",
  },
  user: {
    type: Schema.ObjectId,
    ref: "User",
  },
  amount: {
    type: Number,
    default: 0,
  },
  date: {
    type: Date,
    default: new Date(),
  },
});

donationSchema.pre("save", function (next) {
  const donation = this.toObject() as any;
  donation.userId = donation.user.toString();
  donation.campaignId = donation.campaign.toString();
  delete donation.id;
  delete donation.user;
  delete donation.campaign;
  delete donation.date; //

  const { error } = donationSchemaJoi.validate(donation);
  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }
  next();
});

export const Donation = model("Donation", donationSchema);
