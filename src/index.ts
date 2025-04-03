import mongoose from "mongoose";
import dotenv from "dotenv";
import { app } from "./app";

// Handle uncaught exceptions (complementary)
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

dotenv.config({ path: "./config.env" });
const DB = process.env.DATABASE_URL!.replace(
  "<db_password>",
  process.env.DATABASE_PASSWORD!
);

mongoose
  .connect(DB)
  .then(() => console.log("Db connected!"))
  .catch((err) => console.log("Db failed", err));

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

// Handle unhandled rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "Reason:", reason);

  server.close(() => process.exit(1));
});
