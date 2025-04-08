import { User } from "../models/userModel";
import AppError from "../utils/appError";
import { catchAsync } from "../utils/catchAsync";
import { sendEmail, signInToken } from "../utils/data";
import crypto from "crypto";
import { AuthRequest, login } from "./authController";

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
