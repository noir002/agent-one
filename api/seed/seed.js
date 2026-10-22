import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { parse } from "csv-parse/sync";
import { connectDB } from "../src/db.js";
import Listing from "../src/models/Listing.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const csvPath = path.join(__dirname, "listings.csv");

async function seed() {
  await connectDB();

  const csvText = fs.readFileSync(csvPath, "utf-8");
  const rows = parse(csvText, { columns: true, skip_empty_lines: true, trim: true });

  for (const row of rows) {
    const doc = {
      slug: row.slug,
      name: row.name,
      type: row.type,
      category: row.category,
      pricing: row.pricing,
      openSource: row.openSource === "true",
      interfaceType: row.interfaceType || "none",
      sourceUrl: row.sourceUrl,
      repoUrl: row.repoUrl || "",
      tagline: row.tagline || "",
      description: row.description || "",
      factSource: row.factSource || row.sourceUrl,
      tier: "L0",
    };
    await Listing.findOneAndUpdate(
      { slug: doc.slug },
      { $set: doc },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`[seed] upserted ${doc.slug}`);
  }

  console.log(`[seed] done — ${rows.length} listings loaded`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
