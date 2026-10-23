import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Resolves to the monorepo root .env regardless of which workspace invoked
// node or what the process's cwd happens to be (e.g. `cd api && npm run dev`
// vs `npm run dev -w api` from the repo root resolve to different cwds, but
// every service reads config from the same one .env at the repo root).
// Bare `dotenv/config` resolves `.env` relative to process.cwd(), which is
// why this exists — every entrypoint should import this instead.
export function loadRootEnv() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  dotenv.config({ path: path.resolve(here, "../.env") });
}
