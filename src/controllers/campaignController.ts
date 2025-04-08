import multer from "multer";
import { catchAsync } from "../utils/catchAsync";
import AppError from "../utils/appError";
import e from "express";
import { Campaign } from "../models/campaignModel";
import slugify from "slugify";
import path from "path";
const fs = require("fs");

const multerStorage = multer.diskStorage({
  destination(_req, _file, callback) {
    callback(null, "public/img/medias");
  },

  filename(req, file, callback) {
    const randomSuffix = Math.round(Math.random() * 1e9);

    const ext = file.mimetype.split("/")[1];
    callback(
      null,
      `medias-${(req.user as any).id}-${Date.now()}-${randomSuffix}.${ext}`
    );
  },
});

const multerFiler = (
  req: e.Request,
  file: Express.Multer.File,
  callback: multer.FileFilterCallback
) => {
  if (
    file.mimetype.startsWith("image") ||
    file.mimetype.startsWith("video/mp4")
  ) {
    callback(null, true);
  } else {
    const temp = new AppError(
      "Not an Image or Video! Please upload only images or videos(mp4).",
      400
    );

    callback(temp);
  }
};

export const mediasUpload = multer({
  storage: multerStorage,
  fileFilter: multerFiler,
});

export const uploadMedias = mediasUpload.array("media", 3);

export const createCampaign = catchAsync(async (req, res, next) => {
  const tempFiles = req.files as Express.Multer.File[] | undefined;
  try {
    if (!tempFiles) {
      return next(new AppError("Media not found.", 400));
    }

    if (tempFiles.length < 3) {
      return next(new AppError("Media not up to required length", 400));
    }
    const mediaFilenames = tempFiles.map((ev) => ev.filename);

    const { title, description, priceTarget, startDate, endDate } = req.body;

    const newCampaign = await Campaign.create({
      title,
      slug: slugify(`${title}-${Date.now()}`, {
        lower: true,
      }),
      description,
      priceTarget,
      startDate,
      endDate,
      medias: mediaFilenames,
    });

    res.status(201).json({
      status: "success",
      data: {
        campaign: newCampaign,
      },
    });
  } catch (error) {
    if (tempFiles && tempFiles.length > 0) {
      for (const file of tempFiles) {
        fs.unlink(path.join(file.destination, file.filename), (err: Error) => {
          if (err) console.error("Failed to delete file:", file.filename, err);
        });
      }
    }

    next(error);
  }
});
