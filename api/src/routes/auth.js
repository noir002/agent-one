import { Router } from "express";
import Listing from "../models/Listing.js";

const router = Router();

router.get("/", async (req, res) => {
  if (!req.user) return res.json({ user: null });

  const myListings = req.user.role === "owner" || req.user.role === "admin"
    ? await Listing.find({ ownerId: req.user._id }).select("slug name tier status").lean()
    : [];

  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      role: req.user.role,
      email: req.user.email || null,
    },
    myListings,
  });
});

export default router;
