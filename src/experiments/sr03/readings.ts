/**
 * WHAT EACH DISTANCE IN SR-03 IS CALLED (am-sr03-default-readings-not-rod-ends-bf7w).
 *
 * SR-03's default readings are two platform marks 10 ls apart, simultaneous in K, while the rod,
 * at rest in k, is 8 ls long in K at 0.6c and 6 ls at 0.8c. Live showed "a distance in frame K:
 * 10.00 ls" above a strip drawing the rod at 8.00 ls, and a reader took the platform distance for
 * the rod's length: the confusion the instrument exists to remove. 4a59be2d fixed the sentence
 * inside the strip component, which still computed the rod's L₀/γ itself.
 *
 * This is the one place that decides what a distance is called, from the owner's accepted outputs
 * alone (src/workers/operations/sr03.ts): the rod's own length in each frame, its two ends read at
 * one time there (rodLengthK, rodLengthKPrime), and whether the two readings lie on those ends
 * (readingsOnRodEnds). A separation is called the rod's length only when the owner says the
 * readings are the rod's ends; platform marks are called "platform marks, not the rod". The strips,
 * the verdict, the status line and the values table render this and compute nothing.
 */
import type { FrameId } from "./definition.ts";

/**
 * The part of an owner output this reads: the owner's ScientificResult, or the store's
 * PublishedResult, whose value may be a numeric view. Only a finite number is taken as a value.
 */
export type Sr03Output = Readonly<{ quantityId: string; status: string; value?: unknown }>;

export type Sr03ReadingsKind =
  | "rod-ends"
  | "platform-marks"
  | "example-events"
  | "entered-events"
  | "chosen-events";

export type Sr03Strip = Readonly<{
  frame: FrameId;
  /** The rod rests in this frame, so its length here is the proper length L₀. */
  atRest: boolean;
  /** The owner's rod length in this frame, its ends read at one time of it; null if unreported. */
  length: number | null;
}>;

export type Sr03ReadingsView = Readonly<{
  kind: Sr03ReadingsKind;
  /** The owner says the two readings lie on the rod's two ends. */
  rodEnds: boolean;
  /** Simultaneous in the measuring frame, so their separation is a distance there. */
  simultaneous: boolean;
  /** The readings' separation in the measuring frame (measuredLength), when simultaneous there. */
  separation: number | null;
  /** The rod's own length in the measuring frame, from the owner. */
  rodLength: number | null;
  /** The readings' Δx and cΔt in the measuring frame, as the owner reports them. */
  dx: number | null;
  cdt: number | null;
  /** The rod in K, then in k. */
  strips: readonly Sr03Strip[];
  /** The verdict under the strips, and the second half of the status line. */
  verdict: string;
  /** Labels for the values table that depend on what the readings are. */
  valueLabels: Readonly<Record<string, string>>;
}>;

const KIND_OF_PAIR: Readonly<Record<string, Sr03ReadingsKind>> = {
  "platform-simultaneous": "platform-marks",
  "causal-timelike": "example-events",
  "causal-lightlike": "example-events",
  "causal-threshold": "example-events",
  custom: "entered-events",
};

const WORDS: Readonly<Record<Sr03ReadingsKind, string>> = {
  "rod-ends": "the rod's two ends",
  "platform-marks": "two marks on the platform",
  "example-events": "two events of the causal-order example",
  "entered-events": "the two events you entered",
  "chosen-events": "two chosen events",
};

/** The distance label for readings that are not the rod's ends, saying so. */
const NOT_THE_ROD: Readonly<Record<Exclude<Sr03ReadingsKind, "rod-ends">, string>> = {
  "platform-marks": "platform marks, not the rod",
  "example-events": "example events, not the rod",
  "entered-events": "your events, not the rod",
  "chosen-events": "chosen events, not the rod",
};

function numeric(outputs: readonly Sr03Output[], id: string): number | null {
  const out = outputs.find((o) => o.quantityId === id);
  return out?.status === "value" && typeof out.value === "number" && Number.isFinite(out.value)
    ? out.value
    : null;
}

const ls = (value: number | null) => (value === null ? "not computed" : `${value.toFixed(2)} ls`);

export function sr03ReadingsView(
  p: Readonly<{ endpointPairId: string; rodRestFrame: FrameId; measuringFrame: FrameId }>,
  outputs: readonly Sr03Output[],
): Sr03ReadingsView {
  const m = p.measuringFrame;
  // Only the owner may say the readings are the rod's ends; an unreported classification is not.
  const rodEnds = numeric(outputs, "readingsOnRodEnds") === 1;
  const kind: Sr03ReadingsKind = rodEnds
    ? "rod-ends"
    : (KIND_OF_PAIR[p.endpointPairId] ?? "chosen-events");
  const measured = outputs.find((o) => o.quantityId === "measuredLength");
  const simultaneous = measured?.status === "value";
  const separation = simultaneous ? numeric(outputs, "measuredLength") : null;
  const rodIn: Readonly<Record<FrameId, number | null>> = {
    K: numeric(outputs, "rodLengthK"),
    k: numeric(outputs, "rodLengthKPrime"),
  };
  const rodLength = rodIn[m];
  const dx = numeric(outputs, m === "K" ? "spatialSeparationK" : "spatialSeparationKPrime");
  const cdt = numeric(outputs, m === "K" ? "temporalSeparationK" : "temporalSeparationKPrime");

  // A separation is the rod's length only when the readings are its two ends AND simultaneous in
  // the measuring frame: the rod's ends read at different times are not a length.
  const rod = `The rod itself, its ends read at one time of frame ${m}, is ${ls(rodLength)} long there.`;
  const verdict = !simultaneous
    ? rodEnds
      ? `They are the rod's two ends, but not read at one time of frame ${m}, so their separation is not a length measurement. ${rod}`
      : `They are not simultaneous there, so their separation is not a length measurement. ${rod}`
    : kind === "rod-ends"
      ? `They are the rod's two ends, read at one time of frame ${m}, so their separation is the rod's length there: ${ls(separation)}.`
      : `They are ${WORDS[kind]}, not the rod's ends, and simultaneous in frame ${m}, so ${ls(separation)} is the distance between them there, not the rod's length. ${rod}`;

  const valueLabels: Record<string, string> = {
    rodLengthK: "The rod's length in K, its ends read at one time of K",
    rodLengthKPrime: "The rod's length in k, its ends read at one time of k",
  };
  if (kind === "rod-ends" && simultaneous) {
    valueLabels.measuredLength = `The rod's length in frame ${m}, its two ends read at one time there`;
  } else if (kind === "rod-ends") {
    valueLabels.measuredLength = `Distance between the rod's two ends, read at different times of frame ${m} (not a length)`;
  } else {
    const not = NOT_THE_ROD[kind];
    valueLabels.measuredLength = `Distance between the two readings at one time of frame ${m} (${not})`;
    valueLabels.spatialSeparationK = `Distance between the two readings in K, Δx (${not})`;
    valueLabels.spatialSeparationKPrime = `Distance between the two readings in k, Δx′ (${not})`;
  }

  return {
    kind,
    rodEnds,
    simultaneous,
    separation,
    rodLength,
    dx,
    cdt,
    strips: (["K", "k"] as const).map((frame) => ({
      frame,
      atRest: p.rodRestFrame === frame,
      length: rodIn[frame],
    })),
    verdict,
    valueLabels,
  };
}
