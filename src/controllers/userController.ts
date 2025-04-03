import { User } from "../models/userModel";
import AppError from "../utils/appError";
import { catchAsync } from "../utils/catchAsync";
import { sendEmail, signInToken } from "../utils/data";
import crypto from "crypto";
import { AuthRequest } from "./authController";

export const createUser = catchAsync(async (req, res, next) => {
  const { firstName, lastName, email, password, confirmPassword } = req.body;

  const newUser = await User.create({
    firstName,
    lastName,
    email,
    password,
    confirmPassword,
  });

  const emailVerificationToken = newUser.generateEmailVerificationToken();

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

    res.send(201).json({
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
  const { token } = req.params;

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    emailVerifiedToken: hashedToken,
    emailVerifiedTokenExpires: {
      $gt: Date.now(),
    },
  });

  if (!user) {
    return next(new AppError("Invalid token or has expired", 400));
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

export const loginUser = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError("Please provide email and password!", 400));
  }

  const user = await User.findOne({ email });

  if (!user || !(await user.isPasswordCorrect(password))) {
    return next(new AppError("Incorrect email or password!", 401));
  }

  if (!user.emailVerified) {
    return next(new AppError("Email not verified!", 403));
  }

  const token = signInToken(user.id);

  res.send(200).json({
    status: "success",
    token,
    data: {
      user,
    },
  });
});

export const forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    return new AppError("Email doesn't exist.", 400);
  }

  const resetPassswordToken = user.generateResetPasswordToken();

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

    res.send(201).json({
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
  const { token, password, confirmPassword } = req.params;

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

  console.log((req as any).user, "dlkkl");

  const user = await User.findById({
    id: (req as any)?.user?.id,
  });

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
