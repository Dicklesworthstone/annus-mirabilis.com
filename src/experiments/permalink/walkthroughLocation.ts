import type { CheckpointWalkthrough, WalkthroughCatalogue } from "./walkthroughCheckpoints.ts";

/** Public authored selection only. These parameters never contain answers or saved experiment data. */
export const WALKTHROUGH_URL_LIMIT = 2048;
export type WalkthroughSelection = Readonly<{ tapeId: string; actionIndex: number | null }>;
export type WalkthroughLocation =
  | Readonly<{ kind: "absent" }>
  | Readonly<{ kind: "invalid"; notice: string }>
  | Readonly<{ kind: "selected"; selection: WalkthroughSelection }>;
const INVALID = "This walkthrough link is incomplete or ambiguous. Choose a walkthrough below; no checkpoint was selected.";
const validId = (value: string) => /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,159}$/.test(value) &&
  !["constructor", "prototype", "__proto__"].includes(value);
const validAction = (value: number) => Number.isSafeInteger(value) && value >= 0;

/** An action index is the author's index, not the position of a stop in a menu. */
export function readWalkthroughLocation(search: string): WalkthroughLocation {
  if (search.length > WALKTHROUGH_URL_LIMIT) return { kind: "invalid", notice: INVALID };
  const params = new URLSearchParams(search);
  const ids = params.getAll("walkthrough");
  const stops = params.getAll("stop");
  if (ids.length === 0 && stops.length === 0) return { kind: "absent" };
  const tapeId = ids[0];
  const stop = stops[0];
  if (ids.length !== 1 || !tapeId || !validId(tapeId) || stops.length > 1 ||
      (stop !== undefined && (!/^(?:0|[1-9][0-9]*)$/.test(stop) || !validAction(Number(stop))))) {
    return { kind: "invalid", notice: INVALID };
  }
  return { kind: "selected", selection: { tapeId, actionIndex: stop === undefined ? null : Number(stop) } };
}

export type ResolvedWalkthroughLocation =
  | Readonly<{ kind: "invalid"; notice: string }>
  | Readonly<{ kind: "selected"; walkthrough: CheckpointWalkthrough; index: number }>;

/** Never replace a missing or wrong-laboratory selection with the first available walkthrough. */
export function resolveWalkthroughLocation(
  selection: WalkthroughSelection,
  experimentId: string,
  catalogue: WalkthroughCatalogue,
): ResolvedWalkthroughLocation {
  const matches = catalogue.walkthroughs.filter((entry) => entry.tapeId === selection.tapeId);
  const walkthrough = matches[0];
  if (matches.length !== 1 || !walkthrough || walkthrough.experimentId !== experimentId) {
    return { kind: "invalid", notice: "This recorded walkthrough is not available in this laboratory. No checkpoint was selected." };
  }
  if (selection.actionIndex === null) return { kind: "selected", walkthrough, index: 0 };
  const indices = walkthrough.checkpoints.flatMap((checkpoint, index) =>
    checkpoint.actionIndex === selection.actionIndex ? [index] : []);
  const index = indices[0];
  if (indices.length !== 1 || index === undefined) {
    return { kind: "invalid", notice: "This recorded stop is missing or ambiguous in this edition. No checkpoint was selected." };
  }
  return { kind: "selected", walkthrough, index };
}

/**
 * Add a selection to a laboratory-owned settings link without decoding or rewriting its query.
 * A null result is a named launch gap, not permission to drop the selection or the settings.
 */
export function withWalkthroughSelection(
  href: string,
  experimentId: string,
  tapeId: string,
  actionIndex: number | null = null,
): string | null {
  if (!/^[a-z][a-z0-9-]{1,79}$/.test(experimentId) || !validId(tapeId) ||
      (actionIndex !== null && !validAction(actionIndex)) || href.length > WALKTHROUGH_URL_LIMIT) return null;
  for (const character of href) {
    const code = character.charCodeAt(0);
    if (code <= 32 || code === 127 || character === "\\") return null;
  }
  const base = `/lab/${experimentId}/`;
  if (href !== base && !href.startsWith(`${base}?`) && !href.startsWith(`${base}#`)) return null;
  const hashAt = href.indexOf("#");
  const head = hashAt < 0 ? href : href.slice(0, hashAt);
  const hash = hashAt < 0 ? "" : href.slice(hashAt);
  const queryAt = head.indexOf("?");
  const location = readWalkthroughLocation(queryAt < 0 ? "" : head.slice(queryAt));
  if (location.kind !== "absent") {
    return location.kind === "selected" && location.selection.tapeId === tapeId &&
      location.selection.actionIndex === actionIndex ? href : null;
  }
  const joiner = queryAt < 0 ? "?" : /[?&]$/.test(head) ? "" : "&";
  const next = `${head}${joiner}walkthrough=${encodeURIComponent(tapeId)}${actionIndex === null ? "" : `&stop=${actionIndex}`}${hash}`;
  return next.length <= WALKTHROUGH_URL_LIMIT ? next : null;
}

/** Listen to real browser navigation without replacing history methods or starting an experiment. */
export function observeWalkthroughLocation(
  source: Pick<Window, "location" | "addEventListener" | "removeEventListener">,
  receive: (location: WalkthroughLocation) => void,
): () => void {
  let active = true;
  const read = () => {
    if (active) receive(readWalkthroughLocation(source.location.search));
  };
  source.addEventListener("popstate", read);
  source.addEventListener("pageshow", read);
  read();
  return () => {
    active = false;
    source.removeEventListener("popstate", read);
    source.removeEventListener("pageshow", read);
  };
}
