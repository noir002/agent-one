import { Router } from "express";
import Listing from "../models/Listing.js";
import Manifest from "../models/Manifest.js";
import ScoreSnapshot from "../models/ScoreSnapshot.js";
import { CATEGORIES, LISTING_TYPES, PRICING_MODELS, INTERFACE_TYPES } from "@agentone/shared";
import { slugify } from "../utils/slugify.js";
import { renderBadgeSvg } from "../og/badge.js";

const router = Router();
const PUBLIC_FIELDS = "slug name type category tier tagline description pricing openSource "
  + "interfaceType sourceUrl repoUrl logoUrl status isFlagship isSponsored lastVerifiedAt "
  + "lastCheckStatus score scoreParts createdAt";

router.get("/categories", async (_req, res) => {
  const counts = await Listing.aggregate([
    { $match: { status: "active" } },
    { $group: { _id: "$category", count: { $sum: 1 } } },
  ]);
  const byCategory = Object.fromEntries(counts.map((c) => [c._id, c.count]));
  res.json({
    categories: CATEGORIES.map((category) => ({ category, count: byCategory[category] || 0 })),
  });
});

router.get("/compare", async (req, res) => {
  const slugs = String(req.query.slugs || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (slugs.length < 2 || slugs.length > 3) {
    return res.status(400).json({ error: "Provide 2-3 slugs to compare, e.g. ?slugs=a,b,c" });
  }
  const listings = await Listing.find({ slug: { $in: slugs }, status: "active" }).select(PUBLIC_FIELDS).lean();
  res.json({ listings });
});

router.get("/", async (req, res) => {
  const {
    q, category, tier, type, pricing, interfaceType, openSource, section, sort,
  } = req.query;

  const filter = { status: "active" };
  if (category) filter.category = category;
  if (tier) filter.tier = tier;
  if (type) filter.type = type;
  if (pricing) filter.pricing = pricing;
  if (interfaceType) filter.interfaceType = interfaceType;
  if (openSource === "true") filter.openSource = true;
  if (q) filter.$text = { $search: String(q) };

  if (section === "new") {
    // "New this week"
    filter.createdAt = { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
  } else if (section === "recently-verified") {
    filter.lastVerifiedAt = { $ne: null };
  }

  if (sort === "score") {
    // Conflict of interest: Agent One's own flagships are never ranked
    // against outside agents, per the HLD's anti-gaming rule.
    filter.isFlagship = { $ne: true };
  }

  let query = Listing.find(filter).select(PUBLIC_FIELDS);

  if (sort === "score") query = query.sort({ score: -1, lastVerifiedAt: -1 });
  else if (sort === "new") query = query.sort({ createdAt: -1 });
  else if (section === "recently-verified") query = query.sort({ lastVerifiedAt: -1 });
  else {
    // Default: tier (higher first), then freshness — stale listings sink.
    query = query.sort({ tier: -1, lastVerifiedAt: -1, name: 1 });
  }

  const listings = await query.limit(200).lean();
  res.json({ listings });
});

// Submit a brand-new listing (as opposed to claiming an existing seeded
// one — see routes/claims.js). Starts at L0, same as any imported listing;
// the submitter can file a claim on it afterward to become its owner.
router.post("/", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Sign in to submit a listing." });

  const {
    name, type, category, tagline, description, pricing, openSource,
    interfaceType, sourceUrl, repoUrl, logoUrl,
  } = req.body || {};

  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Name is required." });
  }
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(", ")}` });
  }
  if (!sourceUrl || typeof sourceUrl !== "string") {
    return res.status(400).json({ error: "sourceUrl (the agent's own site) is required." });
  }
  try {
    new URL(sourceUrl);
  } catch {
    return res.status(400).json({ error: "sourceUrl must be a valid URL." });
  }

  const slug = slugify(name);
  if (!slug) return res.status(400).json({ error: "Name must contain at least one letter or number." });
  if (await Listing.findOne({ slug })) {
    return res.status(409).json({ error: "A listing with this name already exists." });
  }

  const listing = await Listing.create({
    slug,
    name: name.trim(),
    type: LISTING_TYPES.includes(type) ? type : "agent",
    category,
    tagline: tagline || "",
    description: description || "",
    pricing: PRICING_MODELS.includes(pricing) ? pricing : "unknown",
    openSource: Boolean(openSource),
    interfaceType: INTERFACE_TYPES.includes(interfaceType) ? interfaceType : "none",
    sourceUrl,
    repoUrl: repoUrl || "",
    logoUrl: logoUrl || "",
    factSource: sourceUrl,
  });

  res.status(201).json({ listing });
});

// "Badge embed code" on the listing page (Phase 6) points here.
router.get("/:slug/badge.svg", async (req, res) => {
  const listing = await Listing.findOne({ slug: req.params.slug, status: "active" })
    .select("name tier score").lean();
  if (!listing) return res.status(404).type("text/plain").send("Not found");

  const latestSnapshot = listing.score != null
    ? await ScoreSnapshot.findOne({ listingId: listing._id }).sort({ computedAt: -1 }).select("computedAt").lean()
    : null;

  res.set("Content-Type", "image/svg+xml");
  res.set("Cache-Control", "public, max-age=3600");
  res.send(renderBadgeSvg({ ...listing, scoreComputedAt: latestSnapshot?.computedAt }));
});

router.get("/:slug", async (req, res) => {
  const listing = await Listing.findOne({ slug: req.params.slug, status: { $ne: "merged" } }).lean();
  if (!listing) return res.status(404).json({ error: "Listing not found." });
  const manifest = listing.manifestId ? await Manifest.findById(listing.manifestId).lean() : null;
  res.json({ listing, manifest });
});

export default router;
