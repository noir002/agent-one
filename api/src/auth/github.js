import { Router } from "express";
import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";
import User from "../models/User.js";

// Only mounted by app.js when GITHUB_CLIENT_ID/SECRET are set.
export function isGitHubConfigured() {
  return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
}

export function configureGitHubAuth() {
  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: process.env.GITHUB_CALLBACK_URL || "http://localhost:4000/api/auth/github/callback",
  }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      let user = await User.findOne({ githubId: profile.id });
      if (!user) {
        user = await User.create({
          name: profile.displayName || profile.username || "Developer",
          email,
          githubId: profile.id,
          role: "user",
        });
      }
      done(null, user);
    } catch (err) {
      done(err);
    }
  }));

  const router = Router();

  router.get("/github", passport.authenticate("github", { scope: ["user:email"], session: false }));

  router.get("/github/callback", passport.authenticate("github", { session: false, failureRedirect: "/" }),
    (req, res) => {
      req.session.userId = req.user._id.toString();
      res.redirect(process.env.CLIENT_ORIGIN || "/");
    });

  return router;
}
