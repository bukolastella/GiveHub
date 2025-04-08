import { User } from "../models/userModel";
import AppError from "../utils/appError";
import { catchAsync } from "../utils/catchAsync";
import { removeOldAvatarPhoto, sendEmail, signInToken } from "../utils/data";
import crypto from "crypto";
import { AuthRequest, login } from "./authController";
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

export const createUser = catchAsync(async (req, res, next) => {
  const { firstName, lastName, email, password, confirmPassword } = req.body;

  const newUser = await User.create({
    firstName,
    lastName,
    email,
    password,
    confirmPassword,
  });

  const emailVerificationToken = await newUser.generateEmailVerificationToken();
  await newUser.save({
    validateBeforeSave: false,
  });

  const tokenUrl = `${req.protocol}://${req.get(
    "host"
  )}/api/v1/users/verify-email/${emailVerificationToken}`;

  const message = `Verify your email here. ${tokenUrl}`;

  try {
    await sendEmail({
      message,
      subject: "Email Verification",
      to: email,
    });

    res.status(201).json({
      status: "success",
      message: "Verification email sent",
    });
  } catch (error) {
    newUser.emailVerifiedToken = undefined;
    newUser.emailVerifiedTokenExpires = undefined;

    await newUser.save({
      validateBeforeSave: false,
    });

    return next(new AppError("There was an error sending email", 500));
  }
});

export const verifyEmail = catchAsync(async (req, res, next) => {
  const { token } = req.body;

  if (!token) {
    return next(new AppError("Please provide token!", 400));
  }

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    emailVerifiedToken: hashedToken,
    emailVerifiedTokenExpires: {
      $gt: Date.now(),
    },
  });

  if (!user) {
    return next(new AppError("Token no longer valid or has expired", 400));
  }

  user.emailVerifiedToken = undefined;
  user.emailVerifiedTokenExpires = undefined;
  user.emailVerified = true;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    message: "Email verified",
  });
});

// export const loginUser = catchAsync(async (req, res, next) => {
//   const { email, password } = req.body;

//   if (!email || !password) {
//     return next(new AppError("Please provide email and password!", 400));
//   }

//   const user = await User.findOne({ email });

//   if (!user || !(await user.isPasswordCorrect(password))) {
//     return next(new AppError("Incorrect email or password!", 401));
//   }

//   if (user.role !== "user") {
//     return next(new AppError("User not found!", 401));
//   }

//   if (!user.emailVerified) {
//     return next(new AppError("Email not verified!", 403));
//   }

//   const token = signInToken(user.id);

//   res.status(200).json({
//     status: "success",
//     token,
//     data: {
//       user,
//     },
//   });
// });

export const loginUser = login("user");

export const forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(new AppError("Please provide email!", 400));
  }

  const user = await User.findOne({ email });

  if (!user) {
    return next(new AppError("Email doesn't exist.", 400));
  }

  const resetPassswordToken = await user.generateResetPasswordToken();

  await user.save({
    validateBeforeSave: false,
  });

  const tokenUrl = `${req.protocol}://${req.get(
    "host"
  )}/api/v1/users/reset-password/${resetPassswordToken}`;

  const message = `Reset your password here. ${tokenUrl}`;

  try {
    await sendEmail({
      message,
      subject: "Reset Password",
      to: email,
    });

    res.status(201).json({
      status: "success",
      message: "Reset password email sent",
    });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordTokenExpires = undefined;

    await user.save({
      validateBeforeSave: false,
    });

    return next(new AppError("There was an error sending email", 500));
  }
});

export const resetPassword = catchAsync(async (req, res, next) => {
  const { token, password, confirmPassword } = req.body;

  if (!token || !password || !confirmPassword) {
    return next(
      new AppError("Please provide token, password and currentPassword!", 400)
    );
  }

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordTokenExpires: {
      $gt: Date.now(),
    },
  });

  if (!user) {
    return next(new AppError("Invalid token or has expired", 400));
  }

  user.password = password;
  user.confirmPassword = confirmPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordTokenExpires = undefined;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    message: "Reset password successful!",
  });
});

export const updatePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, password, confirmPassword } = req.body;

  if (!currentPassword || !password || !confirmPassword) {
    return next(
      new AppError(
        "Please provide currentPassword, password and currentPassword!",
        400
      )
    );
  }

  const user = await User.findById((req as AuthRequest)?.user?.id);

  if (!user || !(await user.isPasswordCorrect(currentPassword))) {
    return next(new AppError("Current password is wrong", 401));
  }

  user.password = password;
  user.confirmPassword = confirmPassword;
  await user.save();

  const jwtToken = signInToken(user.id);

  res.status(200).json({
    status: "success",
    jwtToken,
  });
});

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
