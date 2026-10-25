import { spawn, execFile } from "node:child_process";
import crypto from "node:crypto";

const execFileAsync = (cmd, args) => new Promise((resolve) => {
  execFile(cmd, args, (error, stdout, stderr) => resolve({ error, stdout, stderr }));
});

// The one safety-critical primitive for executing code we don't fully
// trust — used by both the L3 docker runner (a third party's repo+image)
// and Repo Fixer's own code-exec tool (an LLM-generated fix we haven't
// reviewed). No network by default, hard resource limits, a real timeout
// that force-kills the container, and guaranteed cleanup even on the
// timeout path, in case --rm doesn't fire cleanly.
//
// `mounts` is [{ hostPath, containerPath, readOnly }]. The caller is
// responsible for making sure hostPath only contains what the container
// should see — this function does not sanitize contents, only isolates
// the execution environment itself.
export async function runInContainer({
  image,
  command,
  mounts = [],
  timeoutS = 30,
  memoryMb = 256,
  cpus = 1,
  network = "none", // never pass anything else for untrusted code
}) {
  const containerName = `agentone-sandbox-${crypto.randomBytes(6).toString("hex")}`;

  const args = [
    "run",
    "--name", containerName,
    "--rm",
    "--network", network,
    `--memory=${memoryMb}m`,
    "--memory-swap", `${memoryMb}m`, // no swap beyond the memory limit
    `--cpus=${cpus}`,
    "--pids-limit=128",
    "--security-opt", "no-new-privileges",
  ];
  for (const m of mounts) {
    args.push("-v", `${m.hostPath}:${m.containerPath}${m.readOnly ? ":ro" : ""}`);
  }
  args.push(image, ...command);

  let stdout = "";
  let stderr = "";
  let timedOut = false;

  const exitCode = await new Promise((resolve) => {
    const child = spawn("docker", args);
    const timer = setTimeout(async () => {
      timedOut = true;
      // Try the graceful path first, then force — either way, always
      // follow up with an explicit rm so a hung container never survives
      // this function returning, even if the timing races with --rm.
      await execFileAsync("docker", ["kill", containerName]);
      child.kill("SIGKILL");
    }, timeoutS * 1000);

    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve(code);
    });
    child.on("error", () => resolve(null));
  });

  // Belt-and-suspenders cleanup: ignore errors, the container is very
  // likely already gone via --rm, this just guarantees it in the timeout
  // case where --rm may not have had a chance to run.
  await execFileAsync("docker", ["rm", "-f", containerName]);

  return { stdout, stderr, exitCode, timedOut };
}

export async function buildImageFromDockerfile(buildContextDir, tag) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", ["build", "-t", tag, buildContextDir]);
    let stderr = "";
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("close", (code) => {
      if (code === 0) resolve({ tag });
      else reject(new Error(`docker build failed (exit ${code}): ${stderr.slice(-2000)}`));
    });
  });
}
