import dns from "node:dns/promises";

const FETCH_TIMEOUT_MS = 8000;
const MAX_BODY_BYTES = 2_000_000;

function hostnameFrom(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

async function fetchWithLimits(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
    const reader = res.body?.getReader();
    if (!reader) return "";
    let received = 0;
    let text = "";
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      received += value.length;
      if (received > MAX_BODY_BYTES) break;
      text += decoder.decode(value, { stream: true });
    }
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

// DNS TXT record at _agentone-verify.<domain> must equal the claim's token.
export async function verifyDnsTxt(sourceUrl, token) {
  const hostname = hostnameFrom(sourceUrl);
  if (!hostname) return { verified: false, reason: "Listing has no valid source URL." };
  try {
    const records = await dns.resolveTxt(`_agentone-verify.${hostname}`);
    const flat = records.map((chunks) => chunks.join(""));
    const verified = flat.includes(token);
    return {
      verified,
      reason: verified ? "" : `TXT record at _agentone-verify.${hostname} does not match the claim token.`,
    };
  } catch (err) {
    return { verified: false, reason: `No TXT record found at _agentone-verify.${hostname} (${err.code || err.message}).` };
  }
}

// <meta name="agentone-verify" content="<token>"> must be present on the
// listing's source page.
export async function verifyMetaTag(sourceUrl, token) {
  try {
    const html = await fetchWithLimits(sourceUrl);
    const pattern = new RegExp(
      `<meta[^>]+name=["']agentone-verify["'][^>]+content=["']${token}["']`,
      "i"
    );
    const verified = pattern.test(html);
    return {
      verified,
      reason: verified ? "" : `No <meta name="agentone-verify" content="${token}"> tag found on the page.`,
    };
  } catch (err) {
    return { verified: false, reason: `Could not fetch the source page: ${err.message}` };
  }
}

export async function verifyClaim(sourceUrl, method, token) {
  if (method === "dns") return verifyDnsTxt(sourceUrl, token);
  if (method === "meta-tag") return verifyMetaTag(sourceUrl, token);
  return { verified: false, reason: `Unknown verify method: ${method}` };
}
