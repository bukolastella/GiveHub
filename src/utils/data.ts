import { Schema } from "mongoose";
import jwt, { SignOptions } from "jsonwebtoken";
import nodemailer from "nodemailer";
import path from "path";
const fs = require("fs").promises;

export const extraClean = (schema: Schema) => {
  schema.set("versionKey", false);
  schema.set("timestamps", true);

  const settings = { ...schema.get("toJSON") };

  schema.set("toJSON", {
    virtuals: true,
    transform: (doc, ret) => {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;

      if (settings.transform) {
        (settings.transform as any)(doc, ret);
      }
      // return ret;
    },
  });

  schema.set("toObject", {
    virtuals: true,
    transform: (doc, ret) => {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;

      if (settings.transform) {
        (settings.transform as any)(doc, ret);
      }
      // return ret;
    },
  });
};

export const signInToken = (id: string) => {
  return jwt.sign({ id: id }, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN! as SignOptions["expiresIn"],
  });
};

export const sendEmail = async (options: {
  to: string;
  message: string;
  subject: string;
}) => {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: false,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const mailOptions = {
    from: "B.stella",
    to: options.to,
    subject: options.subject,
    text: options.message,
  };

  await transporter.sendMail(mailOptions);
};

export const removeOldAvatarPhoto = async (filename: string) => {
  // if (filename.startsWith("default")) return;

  const filePath = path.join(
    __dirname,
    "../../",
    "public",
    "img",
    "avatar",
    filename
  );
  await fs.rm(filePath, { force: true }).catch(console.log);
};
