import express from "express";
import {
  createUser,
  forgotPassword,
  loginUser,
  resetPassword,
  restrictTo,
  updatePassword,
  userProtect,
  verifyEmail,
} from "../controllers/authController";
import {
  deleteUserAccount,
  getUserProfile,
  resizeAvatar,
  updateAvatar,
  uploadAvatar,
} from "../controllers/userController";

export const usersRouter = express.Router();

usersRouter.post("/signup", createUser);
usersRouter.post("/verify-email", verifyEmail);
usersRouter.post("/login", loginUser);
usersRouter.post("/forgot-password", forgotPassword);
usersRouter.post("/reset-password", resetPassword);
usersRouter.post(
  "/update-password",
  userProtect,
  restrictTo("user"),
  updatePassword
);
usersRouter.get("/profile", userProtect, restrictTo("user"), getUserProfile);
usersRouter.delete(
  "/delete-account",
  userProtect,
  restrictTo("user"),
  deleteUserAccount
);
usersRouter.post(
  "/avatar",
  userProtect,
  restrictTo("user"),
  uploadAvatar,
  resizeAvatar,
  updateAvatar
);
