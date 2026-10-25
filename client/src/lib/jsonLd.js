// Mirrors api/src/og/jsonLd.js's shape — duplicated rather than shared
// across the client/api workspace boundary (same tradeoff format.js
// already makes for daysSince). Injected client-side as defense-in-depth
// for crawlers that do run JS (e.g. Googlebot); the server-rendered stub
// at api/src/routes/share.js is what matters for crawlers that don't.
export function buildListingJsonLd(listing, reviews, url) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: listing.name,
    description: listing.description || listing.tagline || "",
    url,
    applicationCategory: "AI Agent",
    offers: {
      "@type": "Offer",
      ...(listing.pricing === "free" ? { price: "0", priceCurrency: "USD" } : {}),
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

  if (reviews && reviews.length > 0) {
    const avg = reviews.reduce((sum, r) => sum + r.stars, 0) / reviews.length;
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(avg.toFixed(1)),
      reviewCount: reviews.length,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return jsonLd;
}
