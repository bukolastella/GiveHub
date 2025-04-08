import { User } from "../models/userModel";
import AppError from "../utils/appError";
import { catchAsync } from "../utils/catchAsync";
import { removeOldAvatarPhoto } from "../utils/data";
import { AuthRequest } from "./authController";
import multer from "multer";
import sharp from "sharp";
import e, { NextFunction, Request } from "express";

// const multerStorage = multer.diskStorage({
//   destination(_req, _file, callback) {
//     callback(null, "public/img");
//   },

//   filename(req, file, callback) {
//     const ext = file.mimetype.split("/")[1];
//     callback(null, `avatar-${(req.user as any).id}-${Date.now()}.${ext}`);
//   },
// });

const multerStorage = multer.memoryStorage();

const multerFiler = (
  req: Request,
  file: Express.Multer.File,
  callback: multer.FileFilterCallback
) => {
  if (file.mimetype.startsWith("image")) {
    callback(null, true);
  } else {
    const temp = new AppError("Not an Image! Please upload only images.", 400);

    callback(temp);
  }
};

export const resizeAvatar = catchAsync(
  async (req: Request, res: e.Response, next: NextFunction) => {
    if (!req.file) return next();

    req.file.filename = `avatar-${(req.user as any).id}-${Date.now()}.jpeg`;

    await sharp(req.file.buffer)
      .resize(500, 500, {
        fit: "contain",
      })
      .toFormat("jpeg")
      .jpeg({ quality: 90 })
      .toFile(`public/img/${req.file.filename}`);

    next();
  }
);

export const upload = multer({
  storage: multerStorage,
  fileFilter: multerFiler,
});

export const uploadAvatar = upload.single("avatar");

export const getUserProfile = catchAsync(async (req, res, next) => {
  const user = await User.findById((req as AuthRequest)?.user?.id);

  if (!user) {
    return next(new AppError("User does not exist.", 400));
  }

  res.status(200).json({
    status: "success",
    data: {
      user,
    },
  });
});

export const deleteUserAccount = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndDelete((req as AuthRequest)?.user?.id);

  if (!user) {
    return next(new AppError("User does not exist.", 400));
  }

  res.status(204).json({
    status: "success",
    data: null,
  });
});

export const updateAvatar = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError("Avatar not found.", 400));
  }

  const oldAvatar = (req.user as any)?.avatar;

  const user = await User.findByIdAndUpdate((req as AuthRequest)?.user?.id, {
    avatar: req.file.filename,
  });

  if (!user) {
    return next(new AppError("User not found.", 400));
  }

  await removeOldAvatarPhoto(oldAvatar);

  res.status(200).json({
    status: "success",
    data: {
      user,
    },
  });
});
