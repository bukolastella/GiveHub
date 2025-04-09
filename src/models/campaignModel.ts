import { model, Schema } from "mongoose";
import AppError from "../utils/appError";
import { campaignSchemaJoi } from "../utils/validation";

const campaignSchema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    unique: true,
  },
  slug: {
    type: String,
    required: true,
    trim: true,
    unique: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  medias: {
    type: [String],
    maxLength: 3,
  },
  currentPrice: {
    type: Number,
    default: 0,
  },
  priceTarget: {
    type: Number,
    default: 0,
  },
  startDate: Date,
  endDate: Date,
  status: {
    type: Boolean,
    default: true,
  },
  statusReason: {
    type: String,
    enum: ["price-reached", "deadline-reached"],
  },
});

campaignSchema.pre("save", function (next) {
  const campaign = this.toObject() as any;
  delete campaign.id;

  const { error } = campaignSchemaJoi.validate(campaign);
  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }
  next();
});

export const Campaign = model("Campaign", campaignSchema);
