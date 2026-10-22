import { Router } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";

// Only mounted by app.js when GOOGLE_CLIENT_ID/SECRET are set.
export function isGoogleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function configureGoogleAuth() {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:4000/api/auth/google/callback",
  }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      let user = await User.findOne({ googleId: profile.id });
      if (!user) {
        user = await User.create({
          name: profile.displayName || "Student",
          email,
          googleId: profile.id,
          role: "user",
        });
      }
      done(null, user);
    } catch (err) {
      done(err);
    }
  }));

  const router = Router();

  router.get("/google", passport.authenticate("google", { scope: ["profile", "email"], session: false }));

  router.get("/google/callback", passport.authenticate("google", { session: false, failureRedirect: "/" }),
    (req, res) => {
      req.session.userId = req.user._id.toString();
      res.redirect(process.env.CLIENT_ORIGIN || "/");
    });

  return router;
}
