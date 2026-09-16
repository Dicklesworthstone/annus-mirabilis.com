/**
 * The fixed table of reader faces (AGENTS.md, "Product Shape"; bead
 * am-read-shell-routes-3ua). Faces are a small, closed set — the interface
 * never exposes the Cartesian product of axes as modes, and `?view=` values
 * outside this set fall back to `reading` without an error and without
 * writing the invalid value back to the URL.
 */

export const FACE_IDS = [
  "german",
  "english",
  "gloss",
  "parallel",
  "reading",
  "results",
  "facsimile",
  "split",
] as const;

export type FaceId = (typeof FACE_IDS)[number];

/** Faces `split` can pair, in the order they may appear as panes. */
export const SPLITTABLE_FACE_IDS = [
  "german",
  "english",
  "gloss",
  "parallel",
  "reading",
  "results",
  "facsimile",
] as const;

export type SplittableFaceId = (typeof SPLITTABLE_FACE_IDS)[number];

export type FaceDefinition = Readonly<{
  id: FaceId;
  label: string;
  /** True for `german`/`english`: separate-language documents needing hreflang alternates. */
  isLanguageFace: boolean;
}>;

export const FACE_REGISTRY: Readonly<Record<FaceId, FaceDefinition>> = Object.freeze({
  german: Object.freeze({ id: "german", label: "German source", isLanguageFace: true }),
  english: Object.freeze({ id: "english", label: "English translation", isLanguageFace: true }),
  gloss: Object.freeze({ id: "gloss", label: "Interlinear gloss", isLanguageFace: false }),
  parallel: Object.freeze({ id: "parallel", label: "Parallel bilingual", isLanguageFace: false }),
  reading: Object.freeze({ id: "reading", label: "Explanation", isLanguageFace: false }),
  results: Object.freeze({ id: "results", label: "Results", isLanguageFace: false }),
  facsimile: Object.freeze({ id: "facsimile", label: "Facsimile", isLanguageFace: false }),
  split: Object.freeze({ id: "split", label: "Split view", isLanguageFace: false }),
});

export const DEFAULT_FACE: FaceId = "reading";

export const DEFAULT_SPLIT_PANES: readonly [SplittableFaceId, SplittableFaceId] = [
  "parallel",
  "reading",
];

export function isFaceId(value: unknown): value is FaceId {
  return typeof value === "string" && (FACE_IDS as readonly string[]).includes(value);
}

export function isSplittableFaceId(value: unknown): value is SplittableFaceId {
  return typeof value === "string" && (SPLITTABLE_FACE_IDS as readonly string[]).includes(value);
}
