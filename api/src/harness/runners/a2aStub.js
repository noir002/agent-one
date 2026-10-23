// A2A support is explicitly out of scope until a later phase (per the HLD:
// "Keep A2A as a stub interface for later"). This satisfies the runner
// interface so a manifest can legally declare `interface.type: a2a` without
// the system silently pretending to support it.
export async function runA2aTask() {
  throw new Error("A2A is not implemented yet — this manifest can't be evaluated until a later phase adds it.");
}
