import { model, ObjectId, Schema } from "mongoose";
import validator from "validator";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export interface IUser extends Document {
  id: ObjectId; //
  firstName: string;
  lastName: string;
  email: string;
  emailVerified: boolean;
  password: string;
  confirmPassword: string;
  passwordChangedAt?: Date;
  emailVerifiedToken?: string;
  emailVerifiedTokenExpires?: Date;
  generateEmailVerificationToken(): Promise<string>;
  generateResetPasswordToken(): Promise<string>;
  isPasswordCorrect(value: string): Promise<boolean>;
  resetPasswordToken?: string;
  resetPasswordTokenExpires?: Date;
}

const userSchema = new Schema<IUser>(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
      validate: [validator.isEmail, "Must be a valid email."],
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerifiedToken: String,
    emailVerifiedTokenExpires: Date,
    password: {
      type: String,
      trim: true,
      required: true,
    },
    confirmPassword: {
      type: String,
      trim: true,
      required: true,
      validate: {
        validator: function (value) {
          return value === this.password;
        },
        message: "Passwords do not match!",
      },
    },
    resetPasswordToken: String,
    resetPasswordTokenExpires: Date,
    passwordChangedAt: Date,
  },
  {
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        delete ret.password;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (_, ret) => {
        delete ret.password;
        return ret;
      },
    },
  }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = await bcrypt.hash(this.password, 12);
  this.confirmPassword = undefined!;

  next();
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || this.isNew) return next();

  this.passwordChangedAt = new Date();

  next();
});

userSchema.methods.generateEmailVerificationToken = async function () {
  const emailVerificationToken = crypto.randomBytes(32).toString("hex");

  this.emailVerifiedToken = crypto
    .createHash("sha256")
    .update(emailVerificationToken)
    .digest("hex");

  this.emailVerifiedTokenExpires = Date.now() + 10 * 60 * 1000;

  return emailVerificationToken;
};

userSchema.methods.generateResetPasswordToken = async function () {
  const resetPasswordToken = crypto.randomBytes(32).toString("hex");

  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetPasswordToken)
    .digest("hex");

  this.resetPasswordTokenExpires = Date.now() + 10 * 60 * 1000;

  return resetPasswordToken;
};

userSchema.methods.isPasswordCorrect = async function (passedPassword: string) {
  return await bcrypt.compare(passedPassword, this.password);
};

export const User = model("User", userSchema);
