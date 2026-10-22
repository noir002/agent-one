import { Router } from "express";
import User from "../models/User.js";

const router = Router();

// Dev-mode login: no password, just a name + role. Stands in for Google
// sign-in until GOOGLE_CLIENT_ID is configured (see googleAuth.js).
router.post("/dev-login", async (req, res) => {
  const { name, role } = req.body || {};
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Name is required." });
  }
  const allowedRoles = ["learner", "builder", "admin"];
  const safeRole = allowedRoles.includes(role) ? role : "learner";

  let user = await User.findOne({ name: name.trim(), email: { $exists: false } });
  if (!user) {
    user = await User.create({ name: name.trim(), role: safeRole });
  }
  req.session.userId = user._id.toString();
  res.json({ id: user._id, name: user.name, role: user.role });
});

router.post("/logout", (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

export default router;
