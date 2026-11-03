const TIMEOUT_MS = 10000;
const SECURITY_HEADERS = ["strict-transport-security", "content-security-policy", "x-content-type-options", "x-frame-options"];
const PRIVACY_PATHS = ["/privacy", "/privacy-policy", "/legal/privacy"];

// Node's default fetch sends no User-Agent at all, which some sites'
// anti-bot protection blocks outright (confirmed on a few in this batch) —
// that's a request-identification issue, not a real HTTPS/security
// problem, and shouldn't be mislabeled as one (see httpsValid below). The
// fix is to identify this checker honestly, like any legitimate crawler
// (Googlebot, etc.) does — never a browser's own User-Agent, which would
// be impersonation. A site that blocks an honestly-identified bot is a
// real, if imperfect, data point (same as any automated checker hits), not
// something to work around by pretending to be something else.
const USER_AGENT = "AgentOne-DirectoryHygieneCheck/1.0 (+https://github.com/noir002/agent-one; automated public security-signal check, not a crawler)";

async function fetchWithTimeout(url, opts = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      ...opts,
      headers: { "User-Agent": USER_AGENT, ...opts.headers },
    });
  } finally {
    clearTimeout(timeout);
  }
}

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

async function checkPrivacyPolicy(sourceUrl) {
  const origin = originOf(sourceUrl);
  if (!origin) return false;
  for (const path of PRIVACY_PATHS) {
    try {
      const res = await fetchWithTimeout(`${origin}${path}`, { method: "GET" });
      if (res.ok) return true;
    } catch {
      // try the next path
    }
  }
  return false;
}

function parseGithubRepo(repoUrl) {
  try {
    const u = new URL(repoUrl);
    if (u.hostname !== "github.com") return null;
    const [owner, repo] = u.pathname.replace(/^\//, "").replace(/\/$/, "").split("/");
    return owner && repo ? { owner, repo } : null;
  } catch {
    return null;
  }
}

async function checkGithubRepo(repoUrl) {
  const parsed = parseGithubRepo(repoUrl);
  if (!parsed) return { repoStars: null, repoLicense: "" };
  try {
    // Public, unauthenticated GitHub REST API — real data (stars, license),
    // no key needed, rate-limited but fine at this app's scale. Security-
    // advisory data needs an authenticated scope GitHub doesn't grant
    // anonymously, so this deliberately stops at what's actually available
    // rather than guessing.
    const res = await fetchWithTimeout(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "agent-one-directory-check" },
    });
    if (!res.ok) return { repoStars: null, repoLicense: "" };
    const data = await res.json();
    return { repoStars: data.stargazers_count ?? null, repoLicense: data.license?.spdx_id || "" };
  } catch {
    return { repoStars: null, repoLicense: "" };
  }
}

// "Website security hygiene — automated, public signals; not a test of the
// agent's behavior." Deliberately separate from (and much shallower than)
// the real harness's behavioral safety score (scoreParts.safety), which
// comes from actually running prompt-injection/data-leak/refusal tasks
// against a connected agent (see harness/runEvalRun.js). This only checks
// what's publicly inspectable about a tool's own website, for the
// DirectoryTool collection's lighter-weight entries that have no
// connected endpoint to run anything against.
export async function checkDirectoryToolSecurity(tool) {
  const result = {
    checkedAt: new Date(),
    httpsValid: null,
    securityHeadersFound: null,
    securityHeadersTotal: SECURITY_HEADERS.length,
    privacyPolicyFound: null,
    isOpenSource: Boolean(tool.security?.repoUrl),
    repoUrl: tool.security?.repoUrl || "",
    repoStars: null,
    repoLicense: "",
  };

  // One retry on a thrown fetch — confirmed directly that a few sites
  // (canva.com, gamma.app, notebooklm.google.com) transiently fail under a
  // tight sequential loop of 25 checks but succeed cleanly in isolation;
  // recording that as "HTTPS broken" would be a flaky false negative, not
  // a real finding.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetchWithTimeout(tool.sourceUrl, { method: "GET" });
      // httpsValid means the TLS connection itself succeeded — deliberately
      // independent of the HTTP status code. A 403 from anti-bot protection
      // (common on major sites) still proves HTTPS works; conflating the
      // two would mislabel well-secured sites as broken.
      result.httpsValid = tool.sourceUrl.startsWith("https://");
      result.securityHeadersFound = SECURITY_HEADERS.filter((h) => res.headers.has(h)).length;
      break;
    } catch {
      if (attempt === 2) {
        result.httpsValid = false;
        result.securityHeadersFound = 0;
      }
    }
  }

  result.privacyPolicyFound = await checkPrivacyPolicy(tool.sourceUrl);

  if (result.isOpenSource) {
    const { repoStars, repoLicense } = await checkGithubRepo(result.repoUrl);
    result.repoStars = repoStars;
    result.repoLicense = repoLicense;
  }

  return result;
}
