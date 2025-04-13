import express from "express";
import { restrictTo, userProtect } from "../controllers/authController";
import {
  createCampaign,
  deleteCampaign,
  editCampaign,
  getAllCampaign,
  getCampaign,
  uploadMedias,
} from "../controllers/campaignController";

export const campaignRouter = express.Router();

campaignRouter
  .route("/")
  .post(userProtect, restrictTo("admin"), uploadMedias, createCampaign)
  .get(getAllCampaign);

campaignRouter
  .route("/:id")
  .patch(userProtect, restrictTo("admin"), uploadMedias, editCampaign)
  .get(getCampaign)
  .delete(userProtect, restrictTo("admin"), deleteCampaign);
