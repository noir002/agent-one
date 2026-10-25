// Returns whichever wording is currently active for a task — the original
// or its paraphrase (see Task.activeVariant, flipped by the admin rotation
// tool). Every runner reads task content through this instead of
// task.input/task.fixtures directly, so rotation actually changes what gets
// sent without the runners needing to know paraphrasing exists.
export function getActiveTaskContent(task) {
  if (task.activeVariant === "paraphrase" && task.paraphrase) {
    return { input: task.paraphrase.input, fixtures: task.paraphrase.fixtures };
  }
  return { input: task.input, fixtures: task.fixtures };
}
