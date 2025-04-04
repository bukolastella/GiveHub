import express from "express";
import { globalErrorHandler } from "./controllers/errorController";
import {
  createUser,
  deleteUserAccount,
  forgotPassword,
  getUserProfile,
  loginUser,
  resetPassword,
  updatePassword,
  verifyEmail,
} from "./controllers/userController";
import { userProtect } from "./controllers/authController";

export const app = express();
app.use(express.json());

// // Auth
app.post("/api/v1/users/signup", createUser);
app.post("/api/v1/users/verify-email", verifyEmail);
app.post("/api/v1/users/login", loginUser);
app.post("/api/v1/users/forgot-password", forgotPassword);
app.post("/api/v1/users/reset-password", resetPassword);
app.post("/api/v1/users/update-password", userProtect, updatePassword);
app.get("/api/v1/users/profile", userProtect, getUserProfile);
app.post("/api/v1/users/delete-account", userProtect, deleteUserAccount);

app.all(/(.*)/, (req, res, next) => {
  res.status(404).json({
    status: "fail",
    message: `${req.originalUrl} not found.`,
  });

  next();
});

app.use(globalErrorHandler);
