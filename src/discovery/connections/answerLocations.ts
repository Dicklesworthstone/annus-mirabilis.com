import type { DiscoveryPaper } from "../../content/schemas/discovery.ts";

type AnswerKind = "numeric" | "expression" | "explanation";
export type ConnectionAnswerLocation = Readonly<{
  paper: DiscoveryPaper;
  sourceAnchor: string;
  kind: AnswerKind;
}>;

/** Public question identities only. This table imports no evaluator or private notebook state. */
export const CONNECTION_ANSWER_LOCATIONS = {
  "cross-journey-avogadro-radiation": {
    paper: "light-quanta",
    sourceAnchor: "arg-lq-planck-constants",
    kind: "numeric",
  },
  "cross-journey-avogadro-brownian-estimate": {
    paper: "brownian-motion",
    sourceAnchor: "arg-bm-inference",
    kind: "numeric",
  },
  "cross-journey-avogadro-brownian-lower": {
    paper: "brownian-motion",
    sourceAnchor: "arg-bm-inference",
    kind: "numeric",
  },
  "cross-journey-avogadro-brownian-upper": {
    paper: "brownian-motion",
    sourceAnchor: "arg-bm-inference",
    kind: "numeric",
  },
  "cross-journey-avogadro-dissertation-radius": {
    paper: "brownian-motion",
    sourceAnchor: "arg-bm-inference",
    kind: "numeric",
  },
  "cross-journey-avogadro-dissertation-number": {
    paper: "brownian-motion",
    sourceAnchor: "arg-bm-inference",
    kind: "numeric",
  },
  "cross-journey-avogadro-dissertation-correction": {
    paper: "brownian-motion",
    sourceAnchor: "arg-bm-inference",
    kind: "numeric",
  },
  "cross-journey-avogadro-compare-evidence": {
    paper: "brownian-motion",
    sourceAnchor: "arg-bm-inference",
    kind: "explanation",
  },
  "cross-journey-doppler-eigenvalue-receding": {
    paper: "special-relativity",
    sourceAnchor: "arg-sr-doppler-aberration",
    kind: "numeric",
  },
  "cross-journey-doppler-eigenvalue-approaching": {
    paper: "special-relativity",
    sourceAnchor: "arg-sr-doppler-aberration",
    kind: "numeric",
  },
  "cross-journey-doppler-eigenvalue-forward-light-line": {
    paper: "special-relativity",
    sourceAnchor: "arg-sr-lorentz-map",
    kind: "numeric",
  },
  "cross-journey-doppler-eigenvalue-backward-light-line": {
    paper: "special-relativity",
    sourceAnchor: "arg-sr-lorentz-map",
    kind: "numeric",
  },
  "cross-journey-doppler-eigenvalue-expression": {
    paper: "special-relativity",
    sourceAnchor: "arg-sr-doppler-aberration",
    kind: "expression",
  },
  "cross-journey-doppler-eigenvalue-explanation": {
    paper: "special-relativity",
    sourceAnchor: "arg-sr-doppler-aberration",
    kind: "explanation",
  },
  "cross-journey-effective-mass-energy-equivalent": {
    paper: "mass-energy",
    sourceAnchor: "arg-me-mass-change",
    kind: "numeric",
  },
  "cross-journey-effective-mass-explanation": {
    paper: "mass-energy",
    sourceAnchor: "arg-me-mass-change",
    kind: "explanation",
  },
  "cross-journey-statistical-papers-explanation": {
    paper: "light-quanta",
    sourceAnchor: "arg-lq-entropy-correspondence",
    kind: "explanation",
  },
} as const satisfies Readonly<Record<string, ConnectionAnswerLocation>>;

export function connectionAnswerLocation(partId: string): ConnectionAnswerLocation | null {
  return Object.hasOwn(CONNECTION_ANSWER_LOCATIONS, partId)
    ? CONNECTION_ANSWER_LOCATIONS[partId as keyof typeof CONNECTION_ANSWER_LOCATIONS]
    : null;
}

/** A known cross-paper question cannot be relabelled as another paper or answer form on import. */
export function validConnectionAnswerIdentity(
  paper: string,
  partId: string,
  kind: AnswerKind,
): boolean {
  if (!partId.startsWith("cross-journey-")) return true;
  const location = connectionAnswerLocation(partId);
  return location?.paper === paper && location.kind === kind;
}

export function connectionAnswerHref(
  paper: string,
  partId: string,
  kind: AnswerKind,
): string | null {
  const location = connectionAnswerLocation(partId);
  if (!location || location.paper !== paper || location.kind !== kind) return null;
  return `/connections/#${kind === "explanation" ? "explanation" : "exercise"}-${partId}`;
}
