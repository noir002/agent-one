import YAML from "yaml";
import { CATEGORIES, INTERFACE_TYPES, PRICING_MODELS } from "@agentone/shared";

export class ManifestError extends Error {
  constructor(errors) {
    super(`Invalid agentone.yaml: ${errors.join("; ")}`);
    this.errors = errors;
  }
}

// Parses and validates an agentone.yaml string into the shape Manifest
// expects. Throws ManifestError with every problem found, not just the
// first, so an owner can fix their file in one pass.
export function parseManifest(yamlText) {
  let doc;
  try {
    doc = YAML.parse(yamlText);
  } catch (err) {
    throw new ManifestError([`YAML syntax error: ${err.message}`]);
  }
  if (!doc || typeof doc !== "object") {
    throw new ManifestError(["File is empty or not a YAML mapping."]);
  }

  const errors = [];
  const req = (cond, msg) => { if (!cond) errors.push(msg); };

  req(typeof doc.name === "string" && doc.name.trim(), "`name` is required.");
  req(typeof doc.version === "string" && doc.version.trim(), "`version` is required.");
  req(CATEGORIES.includes(doc.category), `\`category\` must be one of: ${CATEGORIES.join(", ")}.`);

  const owner = doc.owner || {};
  req(typeof owner.name === "string" && owner.name.trim(), "`owner.name` is required.");
  req(typeof owner.contact === "string" && owner.contact.trim(), "`owner.contact` is required.");
  req(["dns", "meta-tag"].includes(owner.verify), "`owner.verify` must be \"dns\" or \"meta-tag\".");

  const iface = doc.interface || {};
  req(INTERFACE_TYPES.includes(iface.type), `\`interface.type\` must be one of: ${INTERFACE_TYPES.join(", ")}.`);
  if (["http", "mcp", "a2a"].includes(iface.type)) {
    req(typeof iface.endpoint === "string" && iface.endpoint.trim(), "`interface.endpoint` is required for this interface type.");
  }

  const permissions = doc.permissions || {};
  if (permissions.network !== undefined) {
    req(["none", "allowlist", "open"].includes(permissions.network), "`permissions.network` must be none, allowlist or open.");
  }

  if (doc.pricing && doc.pricing.model !== undefined) {
    req(PRICING_MODELS.includes(doc.pricing.model), `\`pricing.model\` must be one of: ${PRICING_MODELS.join(", ")}.`);
  }

  if (errors.length) throw new ManifestError(errors);

  return {
    name: doc.name.trim(),
    version: String(doc.version).trim(),
    category: doc.category,
    summary: doc.summary || "",
    owner: { name: owner.name.trim(), contact: owner.contact.trim(), verify: owner.verify },
    interface: {
      type: iface.type,
      endpoint: iface.endpoint || "",
      auth: iface.auth || "",
      streaming: iface.streaming || "",
    },
    model: Array.isArray(doc.model) ? doc.model : ["any"],
    tools: Array.isArray(doc.tools) ? doc.tools : [],
    permissions: {
      network: permissions.network || "none",
      max_steps: Number(permissions.max_steps) || 40,
      max_cost_usd: Number(permissions.max_cost_usd) || 0.5,
      timeout_s: Number(permissions.timeout_s) || 300,
    },
    pricing: { model: doc.pricing?.model || "unknown" },
    license: doc.license || "",
    repo: doc.repo || "",
    rawYaml: yamlText,
  };
}
