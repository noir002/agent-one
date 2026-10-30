import { loadRootEnv } from "@agentone/shared/loadEnv.js";
loadRootEnv();
import mongoose from "mongoose";
import { connectDB } from "../src/db.js";
import DirectoryTool from "../src/models/DirectoryTool.js";
import { checkDirectoryToolSecurity } from "../src/services/directorySecurityCheck.js";

// Same cron-script pattern as freshnessCheck.js/spotCheck.js — CLI-run,
// like every other maintenance script in this codebase (no scheduler is
// wired up for any of them yet). Run after seeding a new batch, or
// periodically to keep hygiene signals current.
async function main() {
  await connectDB();
  const tools = await DirectoryTool.find({ status: "active" });
  console.log(`[directory-security] checking ${tools.length} tools`);

  for (const tool of tools) {
    const security = await checkDirectoryToolSecurity(tool);
    tool.security = security;
    await tool.save();
    console.log(`[directory-security] ${tool.slug}: https=${security.httpsValid} headers=${security.securityHeadersFound}/${security.securityHeadersTotal} privacy=${security.privacyPolicyFound}${security.isOpenSource ? ` stars=${security.repoStars} license=${security.repoLicense || "none"}` : ""}`);
  }

  console.log("[directory-security] done");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[directory-security] failed:", err);
  process.exit(1);
});
