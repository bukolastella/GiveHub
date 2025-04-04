import { Request } from "express";
import { IUser, User } from "../models/userModel";
import AppError from "../utils/appError";
import { catchAsync } from "../utils/catchAsync";
import jwt, { JwtPayload } from "jsonwebtoken";

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
