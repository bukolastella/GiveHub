import { Request } from "express";
import { User } from "../models/userModel";
import AppError from "../utils/appError";
import { catchAsync } from "../utils/catchAsync";
import jwt, { JwtPayload } from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { signInToken } from "../utils/data";
import { Profile } from "passport";

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
