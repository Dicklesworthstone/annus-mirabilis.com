"use client";

import { useEffect, useState } from "react";
import type { LabTapeLinkState } from "../../experiments/permalink/LabTapeLink.tsx";
import type { TapePredictionEvent } from "../../experiments/permalink/types.ts";
import { resolveEffectivePredictEntry } from "../../experiments/predict/predictEntry.ts";
import {
  amendAfterReveal,
  beginPrompt,
  keepToSelf,
  type PredictionChoice,
  type PredictPromptRecord,
  reveal,
  skipPrediction,
  submitPrediction,
} from "../../experiments/predict/predictState.ts";
import {
  getEntryOverride,
  hasVisited,
  markVisited,
  type PredictionsDocumentV1,
  readPredictionsDocument,
  recordPrediction,
  recordUnrecordedStatus,
  writePredictionsDocument,
} from "../../experiments/predict/predictStorage.ts";
import type { GeneratedPredictPrompt } from "../../generated/predict-prompts.ts";
import { createStorageContext } from "../../platform/storage/store.ts";
import { PredictPanel } from "./PredictPanel.tsx";

/**
 * Predict mode for a laboratory, drawn from its manifest's prompts (am-inst-predict-mode-ti7m).
 *
 * A first-time reader with JavaScript is asked before the result is shown: each element spread with
 * `response` stays out of view until the reader chooses a candidate, says they have one in mind, or
 * skips. Skipping always shows the result. Without JavaScript the panel's controls cannot work, so
 * the panel is what goes and the result stays (predict.css keys both on the reader pre-paint's
 * `data-detail`, which only a running script sets). A reader who has answered before, or who chose
 * to explore directly, is not asked again.
 */
export type PredictGateState = Readonly<{
  labId: string;
  prompts: readonly GeneratedPredictPrompt[];
  records: ReadonlyMap<string, PredictPromptRecord>;
  /** True once the result may show: answered, skipped, answered on an earlier visit, or not asked. */
  open: boolean;
  /** Spread onto each element that shows the result. */
  response: Readonly<{ "data-predict-response": "shown" | "awaiting" }>;
  /** The reader's stated predictions, as a shared ?tape= link carries them. */
  predictions: readonly TapePredictionEvent[];
  record(promptId: string, choice: PredictionChoice): void;
  keep(promptId: string): void;
  skip(promptId: string): void;
  amend(promptId: string, choice: PredictionChoice): void;
}>;

function persist(update: (doc: PredictionsDocumentV1) => PredictionsDocumentV1): void {
  const ctx = createStorageContext();
  // A blocked or full store leaves this visit's answer in memory; the result still shows.
  writePredictionsDocument(ctx, update(readPredictionsDocument(ctx)));
}

export function usePredictGate(
  labId: string,
  prompts: readonly GeneratedPredictPrompt[],
): PredictGateState {
  const [records, setRecords] = useState<ReadonlyMap<string, PredictPromptRecord>>(
    () => new Map(prompts.map((p) => [p.promptId, beginPrompt(p.promptId)])),
  );
  // Read after mount: the server markup, and the first client render that hydrates it, both ask.
  const [notAsked, setNotAsked] = useState(false);
  useEffect(() => {
    const ctx = createStorageContext();
    const doc = readPredictionsDocument(ctx);
    const entry = resolveEffectivePredictEntry(ctx, getEntryOverride(doc, labId)).choice;
    if (entry !== "predict-first" || prompts.some((p) => hasVisited(doc, labId, p.promptId)))
      setNotAsked(true);
  }, [labId, prompts]);

  const change = (promptId: string, transform: (r: PredictPromptRecord) => PredictPromptRecord) =>
    setRecords((current) => {
      const next = new Map(current);
      next.set(promptId, transform(current.get(promptId) ?? beginPrompt(promptId)));
      return next;
    });

  const open =
    notAsked || prompts.length === 0 || [...records.values()].some((r) => r.state !== "hidden");
  const predictions: TapePredictionEvent[] = [];
  for (const r of records.values()) {
    if (r.state === "revealed" && r.choice?.form === "candidate")
      predictions.push({
        promptId: r.promptId,
        form: "candidate",
        payload: { candidateId: r.choice.candidateId },
      });
  }

  return {
    labId,
    prompts,
    records,
    open,
    response: { "data-predict-response": open ? "shown" : "awaiting" },
    predictions,
    // The result the prompt asks about is already the accepted one, so a stated prediction is
    // compared with it at once rather than after a further change.
    record(promptId, choice) {
      change(promptId, (r) => reveal(submitPrediction(r, choice)));
      persist((doc) =>
        recordPrediction(markVisited(doc, labId, promptId), labId, promptId, choice),
      );
    },
    keep(promptId) {
      change(promptId, keepToSelf);
      persist((doc) =>
        recordUnrecordedStatus(
          markVisited(doc, labId, promptId),
          labId,
          promptId,
          "predicted-unrecorded",
        ),
      );
    },
    skip(promptId) {
      change(promptId, skipPrediction);
      persist((doc) =>
        recordUnrecordedStatus(markVisited(doc, labId, promptId), labId, promptId, "skipped"),
      );
    },
    amend(promptId, choice) {
      change(promptId, (r) => amendAfterReveal(r, choice));
    },
  };
}

/** The laboratory's predict panels. Shown only with JavaScript; see predict.css. */
export function PredictGatePanels({ gate }: Readonly<{ gate: PredictGateState }>) {
  if (gate.prompts.length === 0) return null;
  return (
    <div className="lab-predict" data-predict-gate={gate.open ? "open" : "awaiting"}>
      {gate.prompts.map((prompt) => (
        <PredictPanel
          key={prompt.promptId}
          prompt={prompt}
          record={gate.records.get(prompt.promptId) ?? beginPrompt(prompt.promptId)}
          forms={["candidate"]}
          resultShown
          describeCandidates={false}
          onRecord={(choice) => gate.record(prompt.promptId, choice)}
          onKeepToSelf={() => gate.keep(prompt.promptId)}
          onSkip={() => gate.skip(prompt.promptId)}
          onAmend={(choice) => gate.amend(prompt.promptId, choice)}
        />
      ))}
      {gate.open ? null : (
        <p className="fine" data-predict-waiting="">
          The result appears when you choose, say you have one in mind, or skip.
        </p>
      )}
    </div>
  );
}

/** A shared link's tape with the reader's stated predictions added, for ShareControl to offer. */
export function withPredictions(link: LabTapeLinkState, gate: PredictGateState): LabTapeLinkState {
  if (!link.shareTape || gate.predictions.length === 0) return link;
  return { ...link, shareTape: { ...link.shareTape, predictions: gate.predictions } };
}
