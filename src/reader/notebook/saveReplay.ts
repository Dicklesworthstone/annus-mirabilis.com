import type { ControlledComparisonState } from "../../experiments/compare/controlledComparison.ts";
import type { NotebookStore } from "./notebookStore.ts";
import { captureComparisonReplay, type ReplayPassage, type ReplayPrediction } from "./replayEntry.ts";
import { parseNotebookEntry, type NotebookReplayEntry } from "./schema.ts";

export async function makeReplayEntry(input: Readonly<{
  state: ControlledComparisonState; passage: ReplayPassage; before: string; after: string; notes: string;
  prediction?: ReplayPrediction | null;
}>, id = crypto.randomUUID(), createdAt = new Date().toISOString()): Promise<NotebookReplayEntry> {
  const replay = await captureComparisonReplay(input.state, input.passage,
    { before: input.before, after: input.after }, input.prediction ?? null);
  return parseNotebookEntry({
    id, createdAt, kind: "replay", title: "My controlled Brownian comparison", text: input.notes,
    frame: { paper: "brownian-motion", anchor: "arg-bm-observable", view: "reading", detail: 1, lens: "paper", open: "" },
    replay,
  }) as NotebookReplayEntry;
}
/** Persists through the notebook's existing owner; no separate replay namespace or URL. */
export async function saveComparisonReplay(store: NotebookStore, input: Parameters<typeof makeReplayEntry>[0]) {
  return store.add(await makeReplayEntry(input));
}
