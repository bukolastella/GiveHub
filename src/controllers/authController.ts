import { Request } from "express";
import { User } from "../models/userModel";
import AppError from "../utils/appError";
import { catchAsync } from "../utils/catchAsync";
import jwt, { JwtPayload } from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { sendEmail, signInToken } from "../utils/data";
import { Profile } from "passport";
import crypto from "crypto";

export interface AuthRequest extends Request {
  user?: { id: string };
}

export const userProtect = catchAsync(async (req, res, next) => {
  let token: string | undefined;

  const { authorization } = req.headers;

  if (authorization && authorization.startsWith("Bearer")) {
    token = authorization.split(" ")[1];
  }
  if (!token) {
    return next(
      new AppError("You are not logged in. Login to get access!", 401)
    );
  }

  function verifyToken(token: string, secret: string) {
    return new Promise((resolve, reject) => {
      jwt.verify(token, secret, (err, decoded) => {
        if (err) return reject(err);
        resolve(decoded);
      });
    });
  }
  const decoded = (await verifyToken(
    token,
    process.env.JWT_SECRET!
  )) as JwtPayload;

  const freshUser = await User.findById(decoded.id);

  if (!freshUser) {
    return next(
      new AppError("The user belonging to this token no longer exists", 401)
    );
  }

  if (await (freshUser as any).hasPasswordChangedAfter(decoded.iat)) {
    return next(
      new AppError("User recently changed password. please log in again", 401)
    );
  }

  (req as any).user = freshUser;

  next();
});

export const restrictTo = (...roles: string[]) => {
  return (req: any, res: any, next: any) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to perform this action", 403)
      );
    }

    next();
  };
};

export const login = (role: string) =>
  catchAsync(async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new AppError("Please provide email and password!", 400));
    }

    const user = await User.findOne({ email });

    if (!user || !(await user.isPasswordCorrect(password))) {
      return next(new AppError("Incorrect email or password!", 401));
    }

    if (user.role !== role) {
      return next(
        new AppError(
          `${role.charAt(0).toUpperCase() + role.slice(1)} not found!`,
          401
        )
      );
    }

    if (!user.emailVerified) {
      return next(new AppError("Email not verified!", 403));
    }

    const token = signInToken(user.id);

    res.status(200).json({
      status: "success",
      token,
      data: {
        user,
      },
    });
  });

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

export const googleAuth = catchAsync(async (req, res, next) => {
  // res.header("Access-Control-Allow-Origin", "http://localhost:5173"); //
  // res.header("Referrer-Policy", "no-referrer-when-downgrade"); //

  const redirectUrl = "http://127.0.0.1:3000/api/v1/oauth-google";

  const oAuth2Client = new OAuth2Client(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    redirectUrl
  );

  const authorizedUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
      "openid",
    ],
    prompt: "consent",
  });

  res.json({ url: authorizedUrl });
});

interface GoogleUserInfo {
  sub: string;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  email: string;
  email_verified: boolean;
}

export const oAuthGoogle = catchAsync(async (req, res, next) => {
  const { code } = req.query;

  const redirectUrl = "http://127.0.0.1:3000/api/v1/oauth-google";

  const oAuth2Client = new OAuth2Client(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    redirectUrl
  );

  if (!code) {
    next(new AppError("Code not defined", 400));
  }

  const result1 = await oAuth2Client.getToken(code as string);

  oAuth2Client.setCredentials(result1.tokens);

  const oauthUser = oAuth2Client.credentials;

  const temp = await fetch(
    `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${oauthUser.access_token}`
  );

  const data: GoogleUserInfo = await temp.json();

  if (!data.email_verified) {
    next(new AppError("Email not verified", 400));
  }

  const existingUser = await User.findOne({ email: data.email });

  if (existingUser) {
    const token = signInToken(existingUser.id);

    res.status(200).json({
      status: "success",
      token,
      data: {
        user: existingUser,
      },
    });
  } else {
    const newUser = new User({
      firstName: data.given_name,
      lastName: data.family_name,
      email: data.email,
      avatar: data.picture,
      emailVerified: true,
    });

    await newUser.save({
      validateBeforeSave: false,
    });

    const token = signInToken(newUser.id);

    res.status(200).json({
      status: "success",
      token,
      data: {
        user: newUser,
      },
    });
  }
});

export const facebookAuth = async (
  _accessToken: any,
  _refreshToken: any,
  profile: Profile,
  done: any
) => {
  try {
    if (!profile.emails || profile.emails.length === 0) {
      return done(new AppError("Can't find email", 400));
    }

    const email = profile.emails[0].value;

    const user = await User.findOne({ email });

    if (user) {
      const token = signInToken(user.id);
      return done(null, { user, token });
    }

    if (!profile.name) {
      return done(new AppError("Can't find name", 400));
    }

    if (!profile.photos || profile.photos.length === 0) {
      return done(new AppError("Can't find photo", 400));
    }

    // Create new user
    const newUser = new User({
      firstName: profile.name.givenName,
      lastName: profile.name.familyName,
      email: email,
      avatar: profile.photos?.[0]?.value,
      emailVerified: true,
    });

    await newUser.save({ validateBeforeSave: false });

    const token = signInToken(newUser.id);
    return done(null, { user: newUser, token });
  } catch (err) {
    return done(err);
  }
};

export const oAuthFacebook = catchAsync(async (req, res, next) => {
  const { user, token } = (req as any).user;

  res.status(200).json({
    status: "success",
    token,
    data: { user },
  });
});

export const loginAdmin = login("admin");
