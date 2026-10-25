import { Router } from "express";
import User from "../models/User.js";

const router = Router();

// Dev-mode login: no password, just a name + role. Stands in for GitHub/
// Google sign-in until those are configured (see github.js / google.js).
// "owner" isn't selectable here — the HLD grants it only when a claim is
// approved (see routes/claims.js), so dev-login only offers user/admin.
router.post("/dev-login", async (req, res) => {
  const { name, role } = req.body || {};
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Name is required." });
  }
  const allowedRoles = ["user", "admin"];
  const safeRole = allowedRoles.includes(role) ? role : "user";

  let user = await User.findOne({ name: name.trim(), email: { $exists: false } });
  if (!user) {
    user = await User.create({ name: name.trim(), role: safeRole });
  } else if (user.role !== safeRole && safeRole === "admin") {
    // Allow re-login as admin for the same dev name without creating duplicates.
    user.role = safeRole;
    await user.save();
  }
  req.session.userId = user._id.toString();
  res.json({ id: user._id, name: user.name, role: user.role });
});

router.post("/logout", (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

export default router;
