import { Campaign } from "../models/campaignModel";
import { Donation } from "../models/donationModel";
import AppError from "../utils/appError";
import { catchAsync } from "../utils/catchAsync";
import { donationSchemaJoi } from "../utils/validation";

export const payForDonation = catchAsync(async (req, res, next) => {
  const { error, value } = donationSchemaJoi
    .fork(["userId", "reference", "paymentStatus"], (schema) =>
      schema.optional()
    )
    .validate(req.body);

  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }

  const { campaignId, amount } = value;

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

  const params = {
    email: (req.user as any).email,
    amount: amount * 100,
    callback_url: "https://youringhsdj-success-url.com", //
    metadata: {
      cancel_action: "https://your-cancel-url.com", //
      campaignId: campaignId,
      userId: (req.user as any).id,
      donatedAmount: amount,
    },
  };

  const result = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  const resultData = await result.json();

  // console.log(resultData, "rrr");

  if (!resultData.status) {
    return next(new AppError(resultData.message, 400));
  }

  res.status(201).json({
    status: "success",
    data: {
      data: resultData.data.authorization_url,
    },
  });
});

export const createDonation = catchAsync(async (req, res, next) => {
  const { error, value } = donationSchemaJoi
    .fork(["userId", "campaignId", "amount", "paymentStatus"], (schema) =>
      schema.optional()
    )
    .validate(req.body);

  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }

  const { reference } = value;

  const hasUsedRef = await Campaign.find({
    reference,
  });

  if (hasUsedRef) {
    return next(new AppError("Payment has been verified already", 400));
  }

  const result = await fetch(
    `https://api.paystack.co/transaction/verify/${reference}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    }
  );

  const resultData = await result.json();

  // console.log(resultData, "vyu");

  if (!resultData.status) {
    return next(new AppError(resultData.message, 400));
  }

  if (resultData.data.status !== "success") {
    return next(new AppError("Payment not successful", 400));
  }

  const { campaignId, userId, donatedAmount } = resultData.data.metadata;
  const amount = +donatedAmount;

  const tempCampaign = await Campaign.findById(campaignId);

  if (!tempCampaign) {
    return next(new AppError("Can't find campaign.", 400));
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

  const newDonation = await Donation.create({
    user: userId,
    campaign: campaignId,
    amount,
    reference,
    paymentStatus: "success",
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
