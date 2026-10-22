import Listing from "../models/Listing.js";

const TIMEOUT_MS = 10000;

async function isReachable(url) {
  if (!url) return true; // no URL to check counts as not-a-failure
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: "GET", signal: controller.signal, redirect: "follow" });
    return res.ok || (res.status >= 300 && res.status < 400);
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

// Checks one listing's site (and repo, if set) and updates its freshness
// fields. Used by both the bulk script (all listings, for cron) and the
// admin "re-check now" button (one listing).
export async function checkListingFreshness(listing) {
  const siteOk = await isReachable(listing.sourceUrl);
  const repoOk = listing.repoUrl ? await isReachable(listing.repoUrl) : true;
  const ok = siteOk && repoOk;

  listing.lastCheckStatus = ok ? "ok" : "unreachable";
  if (ok) listing.lastVerifiedAt = new Date();
  await listing.save();

  return { slug: listing.slug, ok, siteOk, repoOk };
}

export async function checkAllListings() {
  const listings = await Listing.find({ status: { $ne: "merged" } });
  const results = [];
  for (const listing of listings) {
    results.push(await checkListingFreshness(listing));
  }
  return results;
}
