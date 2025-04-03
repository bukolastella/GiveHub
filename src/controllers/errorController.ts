import { NextFunction, Request, Response } from "express";
import AppError from "../utils/appError";

const handleCastError = (err: any) => {
  const message = `Invalid ${err.path}: ${err.value}`;

  return new AppError(message, 400);
};

const handleDuplicatedErrorDB = (err: any) => {
  const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
  // const value = { ...err.keyValue };

  const message = `${value} already exists. Please try a unique name.`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = (err: any) => {
  const errors = Object.values(err.errors);

  // sending just one error
  const message = `Validation error: ${(errors as any)[0].message}`;

  return new AppError(message, 400);
};

const handleJsonWebTokenError = () =>
  new AppError("Invalid token. Please login again!", 401);

const handleTokenExpiredError = () =>
  new AppError("Your token has expired. Please login again!", 401);

export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  const isDevEnv = process.env.NODE_ENV === "development";
  // let error = { ...err, name: err.name };
  let error = Object.create(err);
  console.error("ERROR:", err);

  if (error.name === "CastError") error = handleCastError(error);
  if (error.code === 11000)
    error = handleDuplicatedErrorDB(error.errorResponse);
  if (error.name === "ValidationError") error = handleValidationErrorDB(error);
  if (error.name === "JsonWebTokenError") error = handleJsonWebTokenError();
  if (error.name === "TokenExpiredError") error = handleTokenExpiredError();

  if (!error.isOperational && !isDevEnv) {
    res.status(500).json({
      status: "error",
      message: "Something went wrong",
    });
  } else {
    res.status(error.statusCode).json({
      status: error.status,
      message: error.message,
      ...(isDevEnv ? { error: error, stack: error.stack } : undefined),
    });
  }
};
