/**
 * Where the predict gate keeps what a reader has answered (am-inst-predict-mode-ti7m).
 *
 * The gate (src/components/lab/PredictGate.tsx) reaches the reader's stored predictions only
 * through this port, and this module imports no storage. That keeps the embed routes' module
 * graph clear of the reader's local data (src/testing/embedImportBoundary.test.ts): an embed is
 * the one route family anyone may frame, and it is served from the reader's origin.
 *
 * Until something installs another, the port remembers nothing: every visit asks, and nothing is
 * written. That is what an embed gets. The site's own routes install the local store by rendering
 * LocalPredictions (src/components/lab/LocalPredictions.tsx): the /lab/ and /discover/ layouts
 * and the paper reader's inline laboratory.
 */
import type { PredictionChoice } from "./predictState.ts";

export type PredictPersistence = Readonly<{
  /** Whether to ask: false for a returning reader, or one who chose to explore directly. */
  asks(labId: string, promptIds: readonly string[]): boolean;
  /** The reader chose a candidate. */
  record(labId: string, promptId: string, choice: PredictionChoice): void;
  /** The reader has a prediction in mind and keeps it to themselves. */
  keep(labId: string, promptId: string): void;
  /** The reader skipped the prompt. */
  skip(labId: string, promptId: string): void;
}>;

/** The default: asks every time and keeps nothing. */
export const REMEMBERS_NOTHING: PredictPersistence = Object.freeze({
  asks: () => true,
  record: () => {},
  keep: () => {},
  skip: () => {},
});

let installed: PredictPersistence = REMEMBERS_NOTHING;

export function installPredictPersistence(persistence: PredictPersistence): void {
  installed = persistence;
}

export function predictPersistence(): PredictPersistence {
  return installed;
}
