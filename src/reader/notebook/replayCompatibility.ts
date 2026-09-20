import type { AliasRecord } from "../../content/aliases.ts";
import type { ComparisonIdentity } from "../../experiments/compare/Baseline.ts";
import { resolveNavigationAlias } from "../anchors/aliases.ts";
import type { ComparisonReplay, ReplayPassage } from "./replayEntry.ts";

export type ReplayCatalogue = Readonly<{
  identity: ComparisonIdentity;
  passages: Readonly<Record<string, ReplayPassage>>;
  aliases: readonly AliasRecord[];
}>;
/** Comparisons with a new model are explicitly new runs, never substituted for saved readouts. */
export function replayCompatibility(
  replay: ComparisonReplay,
  anchor: string,
  current: ReplayCatalogue,
) {
  const mismatches = (
    [
      "modelVersion",
      "streamVersion",
      "allocationId",
      "constantSetId",
      "sourceDigest",
      "artifactDigest",
      "executionLabel",
    ] as const
  ).filter((key) => replay.baseline.identity[key] !== current.identity[key]);
  const resolved = resolveNavigationAlias(anchor, current.aliases, Object.keys(current.passages));
  const target = resolved.kind === "redirect" ? resolved.redirect.resolvedId : anchor;
  const passage = current.passages[target];
  const changed =
    passage !== undefined &&
    (passage.contentRevision !== replay.passage.contentRevision ||
      passage.translationRevision !== replay.passage.translationRevision);
  return Object.freeze({
    modelChanged: mismatches.length > 0,
    mismatches: Object.freeze(mismatches),
    anchor: passage ? target : null,
    passageChanged: changed,
    modelMessage: mismatches.length
      ? "The model has changed since you saved this; replaying starts a new identified run."
      : "Replaying uses the current matching model and creates a new identified run. Saved readouts stay separate.",
    passageMessage: !passage
      ? "The saved passage could not be resolved. Open the saved paper to find the current argument."
      : changed
        ? "The passage has been revised since this entry was saved. The link opens the current text."
        : replay.passage.contentRevision === null
          ? "No passage revision was available when this entry was saved."
          : "The saved passage revision matches this build.",
    aliasMessage:
      resolved.kind === "redirect"
        ? `The saved anchor was retired; ${resolved.redirect.note ?? "its successor is linked"}.`
        : "",
  });
}
