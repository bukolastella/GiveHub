import multer from "multer";
import { catchAsync } from "../utils/catchAsync";
import AppError from "../utils/appError";
import e from "express";
import { Campaign } from "../models/campaignModel";
import slugify from "slugify";
import path from "path";
import fs from "fs";
import { campaignSchemaJoi } from "../utils/validation";

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
  const { error, value } = campaignSchemaJoi
    .fork(
      ["slug", "medias", "currentPrice", "status", "statusReason"],
      (schema) => schema.optional()
    )
    .validate(req.body);

  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }

  try {
    if (!tempFiles) {
      return next(new AppError("Media not found.", 400));
    }

    if (tempFiles.length < 3) {
      return next(new AppError("Media not up to required length", 400));
    }
    const mediaFilenames = tempFiles.map((ev) => ev.filename);

    const { title, description, priceTarget, startDate, endDate } = value;

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
        fs.unlink(path.join(file.destination, file.filename), (err) => {
          if (err) console.error("Failed to delete file:", file.filename, err);
        });
      }
    }

    next(error);
  }
});

export const editCampaign = catchAsync(async (req, res, next) => {
  const tempFiles = req.files as Express.Multer.File[] | undefined;
  const { id } = req.params;

  try {
    if (!tempFiles) {
      throw next(new AppError("Media not found.", 400));
    }

    if (tempFiles.length < 3) {
      throw next(new AppError("Media not up to required length", 400));
    }
    const mediaFilenames = tempFiles.map((ev) => ev.filename);

    const { title, description, priceTarget, startDate, endDate } = req.body;

    const tempCampaign = await Campaign.findById(id);

    if (!tempCampaign) {
      throw next(new AppError("Id not found", 400));
    }

    const oldFilenames = tempCampaign.medias;

    const payload = {
      title,
      slug: slugify(`${title}-${Date.now()}`, {
        lower: true,
      }),
      description,
      priceTarget,
      startDate: tempCampaign.startDate,
      endDate,
      medias: mediaFilenames,
    };

    const newCampaign = await Campaign.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });

    if (!newCampaign) {
      throw next(new AppError("Update failed", 400));
    }

    if (payload.medias && oldFilenames && oldFilenames.length > 0) {
      for (const filename of oldFilenames) {
        const filePath = path.join(
          __dirname,
          "../../",
          "public",
          "img",
          "medias",
          filename
        );
        fs.unlink(filePath, (err) => {
          if (err) console.log(`Deleted old file: ${filePath}`);
        });
      }
    }

    res.status(200).json({
      status: "success",
      data: {
        campaign: newCampaign,
      },
    });
  } catch (error) {
    if (tempFiles && tempFiles.length > 0) {
      for (const file of tempFiles) {
        fs.unlink(path.join(file.destination, file.filename), (err) => {
          if (err) console.error("Failed to delete file:", file.filename, err);
        });
      }
    }

    next(error);
  }
});

export const getAllCampaign = catchAsync(async (req, res, next) => {
  const tempCampaign = await Campaign.find();

  res.status(200).json({
    status: "success",
    result: tempCampaign.length,
    data: {
      campaigns: tempCampaign,
    },
  });
});

export const getCampaign = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const newCampaign = await Campaign.findById(id);

  if (!newCampaign) {
    throw next(new AppError("Id not found", 400));
  }

  res.status(200).json({
    status: "success",
    data: {
      campaign: newCampaign,
    },
  });
});

export const deleteCampaign = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const tempCampaign = await Campaign.findById(id);

  if (!tempCampaign) {
    throw next(new AppError("Id not found", 400));
  }

  const oldFilenames = tempCampaign.medias;

  const newCampaign = await Campaign.findByIdAndDelete(id);

  if (!newCampaign) {
    throw next(new AppError("Delete failed", 400));
  }

  if (oldFilenames && oldFilenames.length > 0) {
    for (const filename of oldFilenames) {
      const filePath = path.join(
        __dirname,
        "../../",
        "public",
        "img",
        "medias",
        filename
      );
      fs.unlink(filePath, (err) => {
        if (err) console.log(`Deleted old file: ${filePath}`);
      });
    }
  }

  res.status(204).json({
    status: "success",
    data: null,
  });
});
