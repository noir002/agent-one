import mongoose from "mongoose";

// A user's self-service "test my GitHub repo in a sandbox" submission —
// separate from Listing/Manifest's normal owner-claims-an-existing-agent
// flow. Phase B only creates/decrypts these; Phase C's repoSubmissions.js
// route is what actually lets a user create one through the UI.
const repoSubmissionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  repoUrl: { type: String, required: true },
  mode: { type: String, enum: ["advanced", "fast_path"], required: true },

  // Fast-path only: runtime/install/entry/io config used to generate the
  // Dockerfile + shim (Phase C). Shaped freely per mode, so Mixed rather
  // than a rigid sub-schema.
  runtimeConfig: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Ephemeral — see secretCrypto.js. Present only between submission and
  // the one sandbox run that consumes it; executeEvalRun() sets this back
  // to null in a `finally` once that run completes, success or failure.
  encryptedCredentials: {
    type: new mongoose.Schema({
      ciphertext: { type: String, required: true },
      iv: { type: String, required: true },
      authTag: { type: String, required: true },
    }, { _id: false }),
    default: null,
  },
  // "Use Agent One's own demo Groq key" instead of a pasted credential —
  // resolved server-side from process.env at container-launch time, same
  // as the judge already does; never exposed to the client.
  useAgentOneDemoKey: { type: Boolean, default: false },

  listingId: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", default: null },
  manifestId: { type: mongoose.Schema.Types.ObjectId, ref: "Manifest", default: null },

  status: { type: String, enum: ["pending", "running", "done", "failed"], default: "pending" },
}, { timestamps: true });

repoSubmissionSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("RepoSubmission", repoSubmissionSchema);
