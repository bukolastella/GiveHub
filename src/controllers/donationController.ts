import { Campaign } from "../models/campaignModel";
import { Donation } from "../models/donationModel";
import AppError from "../utils/appError";
import { catchAsync } from "../utils/catchAsync";
import { donationSchemaJoi } from "../utils/validation";

export const createDonation = catchAsync(async (req, res, next) => {
  const { error, value } = donationSchemaJoi.validate(req.body);

  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }

  const { userId, campaignId, amount } = value;

  const tempCampaign = await Campaign.findById(campaignId);

  if (!tempCampaign) {
    return next(new AppError("Can't find campaign.", 400));
  }

  if (!tempCampaign.status) {
    return next(
      new AppError(
        "Can't donate to this campaign because the status is closed.",
        400
      )
    );
  }

  const newPrice = tempCampaign.currentPrice + amount;

  await Campaign.findByIdAndUpdate(campaignId, {
    currentPrice: newPrice,
  });

  if (newPrice >= tempCampaign.priceTarget) {
    await Campaign.findByIdAndUpdate(campaignId, {
      status: false,
      statusReason: "price-reached",
    });
  }

  if (tempCampaign.endDate ? new Date() > tempCampaign.endDate : false) {
    await Campaign.findByIdAndUpdate(campaignId, {
      status: false,
      statusReason: "deadline-reached",
    });

    return next(
      new AppError(
        "Can't donate to this campaign because the deadline has passed",
        400
      )
    );
  }

  const newDonation = await Donation.create({
    user: userId,
    campaign: campaignId,
    amount,
  });

  res.status(201).json({
    status: "success",
    data: {
      donation: newDonation,
    },
  });
});

export const getAllDonation = catchAsync(async (req, res, next) => {
  const newDonation = await Donation.find().populate([
    { path: "user", select: "firstName lastName" },
    { path: "campaign", select: "title slug" },
  ]);

  if (!newDonation) {
    return next(new AppError("Id not found", 400));
  }

  res.status(200).json({
    status: "success",
    result: newDonation.length,
    data: {
      donation: newDonation,
    },
  });
});

export const getDonation = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const newDonation = await Donation.findById(id).populate([
    { path: "user", select: "firstName lastName" },
    { path: "campaign", select: "title slug" },
  ]);

  if (!newDonation) {
    return next(new AppError("Id not found", 400));
  }

  res.status(200).json({
    status: "success",
    data: {
      donation: newDonation,
    },
  });
});
