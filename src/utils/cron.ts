import cron from "node-cron";
import { Campaign } from "../models/campaignModel";

cron.schedule("0 0 * * *", async () => {
  await Campaign.updateMany(
    {
      endDate: { $lt: new Date() },
      status: true,
    },
    { $set: { status: false, statusReason: "deadline-reached" } }
  );
});
