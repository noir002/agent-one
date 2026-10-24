import { Router } from "express";
import Listing from "../models/Listing.js";

const router = Router();

router.get("/", async (req, res) => {
  if (!req.user) return res.json({ user: null });

  const myListings = req.user.role === "owner" || req.user.role === "admin"
    ? await Listing.find({ ownerId: req.user._id }).select("slug name tier status hideTraceDetail ciTokenHash").lean()
    : [];

  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      role: req.user.role,
      email: req.user.email || null,
      plan: req.user.plan,
      credits: req.user.credits,
    },
    myListings: myListings.map((l) => ({ ...l, hasCiToken: Boolean(l.ciTokenHash), ciTokenHash: undefined })),
  });
});

export default router;
