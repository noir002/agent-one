import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";

const MAX_REDIRECTS = 5;
const MAX_BODY_BYTES = 5_000_000;

// IPv4 ranges that must never be reachable from a manifest-declared
// endpoint: private, link-local (this is where cloud metadata endpoints
// like 169.254.169.254 live), carrier-grade NAT, multicast and reserved
// space. Loopback (127.0.0.0/8) is listed separately — see ALLOW_LOOPBACK_ENDPOINTS.
const IPV4_BLOCKED_RANGES = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];
const IPV4_LOOPBACK = ["127.0.0.0", 8];

// Dev-only escape hatch: local development needs to point a manifest at a
// fixture running on localhost (see api/dev-fixtures/), which is otherwise
// indistinguishable from a real SSRF attempt. This affects loopback ONLY —
// private ranges and the cloud metadata address stay blocked unconditionally,
// in every environment, because those are the attacks that actually matter.
// Never set this in anything resembling a production environment.
function loopbackAllowed() {
  return process.env.ALLOW_LOOPBACK_ENDPOINTS === "true";
}

function ipv4ToInt(ip) {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function matchesRange(target, [base, prefix]) {
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (target & mask) === (ipv4ToInt(base) & mask);
}

function isBlockedIpv4(ip) {
  const target = ipv4ToInt(ip);
  if (!loopbackAllowed() && matchesRange(target, IPV4_LOOPBACK)) return true;
  return IPV4_BLOCKED_RANGES.some((range) => matchesRange(target, range));
}

function isBlockedIpv6(ip) {
  const lower = ip.toLowerCase();
  if (lower === "::1") return !loopbackAllowed(); // loopback
  if (lower.startsWith("fe80:") || lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true; // link-local fe80::/10
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true; // unique local fc00::/7
  // IPv4-mapped (::ffff:a.b.c.d) — unwrap and check the embedded IPv4.
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIpv4(mapped[1]);
  return false;
}

export class SSRFError extends Error {}

// Resolves hostname, rejects if the address is in blocked range, and
// returns the validated IP + family so the caller can pin the actual
// connection to it (defeating DNS-rebinding TOCTOU attacks).
async function resolveAndValidate(hostname) {
  if (net.isIP(hostname)) {
    const family = net.isIP(hostname);
    if ((family === 4 && isBlockedIpv4(hostname)) || (family === 6 && isBlockedIpv6(hostname))) {
      throw new SSRFError(`Blocked address: ${hostname}`);
    }
    return { address: hostname, family };
  }
  const { address, family } = await dns.lookup(hostname);
  if ((family === 4 && isBlockedIpv4(address)) || (family === 6 && isBlockedIpv6(address))) {
    throw new SSRFError(`${hostname} resolves to a blocked address (${address}).`);
  }
  return { address, family };
}

async function singleRequest(url, options, pinnedAddress, pinnedFamily) {
  const parsed = new URL(url);
  const transport = parsed.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const req = transport.request(parsed, {
      method: options.method || "GET",
      // Some real sites (e.g. Wikipedia, per a live test during Phase 4)
      // return 403 without an identifying User-Agent — a sane default
      // avoids every caller needing to know that, while still letting a
      // caller override it explicitly.
      headers: { "User-Agent": "AgentOneHarness/1.0 (+https://agentone.example)", ...options.headers },
      timeout: options.timeoutMs,
      // Node's "Happy Eyeballs" dual-stack connect (default since Node 20)
      // can call `lookup` expecting an array of addresses when it wants to
      // race multiple candidates; we only ever have the one pre-validated
      // address, so disable it and always answer in the plain (err, address,
      // family) form.
      autoSelectFamily: false,
      // Pin the connection to the pre-validated IP instead of letting the
      // transport re-resolve the hostname (which an attacker could flip
      // between our check and the actual connection).
      lookup: (_hostname, opts, cb) => {
        if (opts && opts.all) return cb(null, [{ address: pinnedAddress, family: pinnedFamily }]);
        return cb(null, pinnedAddress, pinnedFamily);
      },
    }, (res) => {
      resolve({ res, req });
    });
    req.on("timeout", () => req.destroy(new Error("Request timed out")));
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function readLimited(res) {
  let received = 0;
  let body = "";
  for await (const chunk of res) {
    received += chunk.length;
    if (received > MAX_BODY_BYTES) {
      res.destroy();
      throw new Error(`Response exceeded ${MAX_BODY_BYTES} bytes.`);
    }
    body += chunk.toString("utf-8");
  }
  return body;
}

// SSRF-safe fetch: validates + pins the IP for the initial request and for
// every redirect hop (manifests endpoints are owner-controlled and
// untrusted input). Use this for every outbound call the harness makes to
// an agent's declared endpoint — never the global `fetch`.
export async function safeFetch(url, options = {}) {
  let currentUrl = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const parsed = new URL(currentUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new SSRFError(`Unsupported protocol: ${parsed.protocol}`);
    }
    const { address, family } = await resolveAndValidate(parsed.hostname);
    const { res } = await singleRequest(currentUrl, { ...options, timeoutMs: options.timeoutMs || 15000 }, address, family);

    if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
      res.resume(); // discard body, we're not using this response
      currentUrl = new URL(res.headers.location, currentUrl).toString();
      continue;
    }

    const body = await readLimited(res);
    return { status: res.statusCode, headers: res.headers, body };
  }
  throw new SSRFError(`Too many redirects (> ${MAX_REDIRECTS}).`);
}

// Same validation/pinning as safeFetch, but returns the raw (already
// redirect-resolved) response stream for SSE consumption instead of
// buffering the whole body — the caller (httpRunner) applies its own
// line-by-line size limit as it reads.
export async function safeFetchStream(url, options = {}) {
  let currentUrl = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const parsed = new URL(currentUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new SSRFError(`Unsupported protocol: ${parsed.protocol}`);
    }
    const { address, family } = await resolveAndValidate(parsed.hostname);
    const { res } = await singleRequest(currentUrl, { ...options, timeoutMs: options.timeoutMs || 15000 }, address, family);

    if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
      res.resume();
      currentUrl = new URL(res.headers.location, currentUrl).toString();
      continue;
    }

    return { status: res.statusCode, headers: res.headers, stream: res };
  }
  throw new SSRFError(`Too many redirects (> ${MAX_REDIRECTS}).`);
}

// Pre-connection host check for callers that can't use safeFetch/safeFetchStream
// directly (e.g. the mcp runner, which hands its endpoint to the MCP SDK's
// own HTTP client). This blocks a manifest that declares an unsafe endpoint
// outright, but — unlike safeFetch's pinned connection — can't defeat a
// DNS-rebinding attack against the SDK's own later requests. Documented gap,
// not a silent one: full protection is only guaranteed through safeFetch.
export async function assertHostIsSafe(url) {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new SSRFError(`Unsupported protocol: ${parsed.protocol}`);
  }
  await resolveAndValidate(parsed.hostname);
}

export const _internal = { isBlockedIpv4, isBlockedIpv6 };
