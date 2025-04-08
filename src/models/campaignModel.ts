import { model, Schema } from "mongoose";

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
  priceTarget: {
    type: Number,
    default: false,
  },
  startDate: Date,
  endDate: Date,
});

export const Campaign = model("Campaign", campaignSchema);
