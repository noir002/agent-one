import { loadRootEnv } from "@agentone/shared/loadEnv.js";
loadRootEnv();
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { connectDB } from "../src/db.js";
import Listing from "../src/models/Listing.js";
import Manifest from "../src/models/Manifest.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiOrigin = `http://localhost:${process.env.PORT || 4000}`;

async function seed() {
  await connectDB();
  const flagships = JSON.parse(fs.readFileSync(path.join(__dirname, "flagships.json"), "utf-8"));

  for (const f of flagships) {
    const listingDoc = {
      slug: f.slug,
      name: f.name,
      type: "agent",
      category: f.category,
      tagline: f.tagline,
      description: f.description,
      pricing: "free",
      openSource: false,
      interfaceType: "http",
      // Self-referential by design — these agents ARE part of Agent One,
      // not an external site; the listing page itself is their "source."
      sourceUrl: `http://localhost:5173/listing/${f.slug}`,
      factSource: "Agent One (built in-house)",
      isFlagship: true,
    };
    const listing = await Listing.findOneAndUpdate(
      { slug: f.slug },
      { $set: listingDoc },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const manifestDoc = {
      listingId: listing._id,
      name: f.slug,
      version: "1.0.0",
      category: f.category,
      summary: f.tagline,
      owner: { name: "Agent One", contact: "team@agentone.internal", verify: "dns" },
      interface: { type: "http", endpoint: `${apiOrigin}${f.endpointPath}`, auth: "none", streaming: "sse" },
      tools: f.toolsAllowed,
      permissions: { network: "none", max_steps: 10, max_cost_usd: 0.25, timeout_s: 120 },
      pricing: { model: "free" },
      license: "Proprietary",
      rawYaml: "",
    };
    let manifest = await Manifest.findOne({ listingId: listing._id });
    manifest = manifest ? Object.assign(manifest, manifestDoc) : new Manifest(manifestDoc);
    await manifest.save();

    listing.manifestId = manifest._id;
    await listing.save();

    console.log(`[seed:flagships] upserted ${f.slug} -> ${manifestDoc.interface.endpoint}`);
  }

  console.log(`[seed:flagships] done — ${flagships.length} flagships loaded`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("[seed:flagships] failed:", err);
  process.exit(1);
});
