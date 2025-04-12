import e from "express";
import { Campaign } from "../models/campaignModel";
import { Donation } from "../models/donationModel";
import AppError from "../utils/appError";
import { catchAsync } from "../utils/catchAsync";
import { donationSchemaJoi } from "../utils/validation";
import { User } from "../models/userModel";
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

export const preValidateDonation = catchAsync(async (req, res, next) => {
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

  //
  next();
});

export const donationStripeInitialize = catchAsync(async (req, res, next) => {
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

  //
  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price_data: {
          currency: "ngn",
          product_data: {
            name: tempCampaign.title,
          },
          unit_amount: amount * 100,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: "http://localhost:4242/success",
    cancel_url: "http://localhost:4242/cancel",
    metadata: {
      campaignId: campaignId,
      userId: (req.user as any).id,
      donatedAmount: amount,
    },
  });

  res.status(200).json({
    status: "success",
    data: {
      data: session.url,
    },
  });
});

export const donationStripeWebhook = catchAsync(async (req, res, next) => {
  const endpointSecret = process.env.STRIPE_DONATION_WEBHOOK_KEY;

  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err: any) {
    return next(new AppError(`Webhook Error: ${err.message}`, 400));
  }

  switch (event.type) {
    case "checkout.session.completed":
      const checkoutSessionCompleted = event.data.object;

      const { campaignId, userId, donatedAmount } =
        checkoutSessionCompleted.metadata;
      const amount = +donatedAmount;

      req.body = {};

      req.body.campaignId = campaignId;
      req.body.userId = userId;
      req.body.amount = amount;
      req.body.reference = checkoutSessionCompleted.id;

      next();
      break;
    default:
      return next(new AppError(`Unhandled event type: ${event.type}`, 400));
  }
});

export const donationPaystackInitialize = catchAsync(async (req, res, next) => {
  const { error, value } = donationSchemaJoi
    .fork(["userId", "reference", "paymentStatus"], (schema) =>
      schema.optional()
    )
    .validate(req.body);

  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }

  const { campaignId, amount } = value;

  const params = {
    email: (req.user as any).email,
    amount: amount * 100,
    callback_url: "https://youringhsdj-success-url.com", //change based on requirement
    metadata: {
      cancel_action: "https://your-cancel-url.com", //change based on requirement
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

  res.status(200).json({
    status: "success",
    data: {
      data: resultData.data.authorization_url,
    },
  });
});

export const verifyPaystackDonation = catchAsync(async (req, res, next) => {
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

  if (hasUsedRef.length > 0) {
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

  req.body.campaignId = campaignId;
  req.body.userId = userId;
  req.body.amount = amount;

  //

  next();
});

export const createDonation = catchAsync(async (req, res, next) => {
  const { error, value } = donationSchemaJoi
    .fork(["paymentStatus"], (schema) => schema.optional())
    .validate(req.body);

  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }

  const { reference, campaignId, userId, amount } = value;

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
  const { search, page, limit } = req.query;

  if ((page && !limit) || (limit && !page)) {
    return next(new AppError("Page and Limit must be defined", 400));
  }

  const filter: Record<string, any> = {};

  if (search !== undefined) {
    const campaigns = await Campaign.find({
      title: { $regex: search, $options: "i" },
    });

    const campaignIds = campaigns.map((c) => c._id);
    filter.campaign = { $in: campaignIds };
  }

  if ((req.user as any).role === "user") {
    const user = await User.findById((req.user as any).id);

    if (!user) {
      return next(new AppError("User not found", 400));
    }

    filter.user = user.id;
  }

  let query = Donation.find(filter).populate([
    { path: "user", select: "firstName lastName" },
    { path: "campaign", select: "title slug" },
  ]);

  const totalDocs = await Donation.countDocuments(filter);
  const queryPage = Number(page) || 1;
  const queryLimit = Number(limit) || totalDocs;
  const skip = (queryPage - 1) * queryLimit;
  const totalPages = Math.ceil(totalDocs / queryLimit);

  query = query.skip(skip).limit(queryLimit);

  const donations = await query;

  const responseBody: any = {
    status: "success",
    result: donations.length,
    data: {
      donations,
    },
  };

  if (page && limit) {
    responseBody.pagination = {
      currentPage: queryPage,
      totalPages,
      totalResults: totalDocs,
      resultsPerPage: queryLimit,
      nextPage: queryPage < totalPages ? queryPage + 1 : null,
      prevPage: queryPage > 1 ? queryPage - 1 : null,
    };
  }

  res.status(200).json(responseBody);
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
