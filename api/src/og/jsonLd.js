// schema.org JSON-LD for a listing page (Phase 7). Used by both the server
// stub (routes/share.js, for non-JS crawlers) and client/Listing.jsx
// (injected on mount, for crawlers that do run JS). `SoftwareApplication`
// is the closest standard type; there's no schema.org type for "AI agent."
// aggregateRating is the *real* 1-5 star Review data (Phase 5) — kept
// separate from the Agent One benchmark score (0-100, a different scale
// and meaning) via additionalProperty rather than conflating the two.
export function buildListingJsonLd(listing, reviewAgg, url) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: listing.name,
    description: listing.description || listing.tagline || "",
    url,
    applicationCategory: "AI Agent",
    offers: {
      "@type": "Offer",
      price: listing.pricing === "free" ? "0" : undefined,
      priceCurrency: listing.pricing === "free" ? "USD" : undefined,
      category: listing.pricing,
    },
  };

  if (listing.score != null) {
    jsonLd.additionalProperty = {
      "@type": "PropertyValue",
      name: "Agent One Score",
      value: Math.round(listing.score),
      description: "Score from 0-100, computed from real, recorded test runs on Agent One — not self-reported.",
    };
  }

  if (reviewAgg && reviewAgg.count > 0) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(reviewAgg.avg.toFixed(1)),
      reviewCount: reviewAgg.count,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return jsonLd;
}
