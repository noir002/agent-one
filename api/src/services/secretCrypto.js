import crypto from "node:crypto";

// Ephemeral-credential encryption for self-service repo submissions
// (RepoSubmission.encryptedCredentials) — a pasted API key has to survive
// the hop from the HTTP request that submits it to whenever a BullMQ
// worker actually picks up the EvalRun, so it can't just live and die with
// one request the way flagships.js's req.llmOverride BYOK does. Held only
// long enough to run the sandboxed container once; executeEvalRun() nulls
// it out in a `finally` regardless of outcome. This is the only place in
// the codebase that persists a secret at rest — there is no other
// precedent to match, so this module is deliberately narrow (one key, one
// algorithm, no key rotation/versioning) rather than a general-purpose
// secrets utility.
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit, the standard/recommended nonce size for GCM

function loadKey() {
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "CREDENTIAL_ENCRYPTION_KEY is not set. Required for any route that encrypts/decrypts submitted credentials — generate one with `openssl rand -base64 32`."
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `CREDENTIAL_ENCRYPTION_KEY must decode (base64) to exactly 32 bytes for AES-256; got ${key.length}.`
    );
  }
  return key;
}

// plaintext: a UTF-8 string (e.g. a JSON blob of { KEY: "value" } pairs).
// Returns the three pieces a GCM decrypt needs, each base64-encoded so the
// whole thing stores cleanly as plain strings on the Mongo document.
export function encrypt(plaintext) {
  const key = loadKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function decrypt({ ciphertext, iv, authTag }) {
  const key = loadKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf-8");
}
