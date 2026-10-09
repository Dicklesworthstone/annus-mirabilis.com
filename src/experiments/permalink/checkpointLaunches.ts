import type { WalkthroughCatalogue } from "./walkthroughCheckpoints.ts";
import { withWalkthroughSelection } from "./walkthroughLocation.ts";

/** The laboratory builds a NEW settings run. An authored historical checkpoint is never rewritten. */
export type CheckpointSettingsLaunch =
  | Readonly<{ status: "ready"; instrumentId: string; href: string; kind: "session" | "form" }>
  | Readonly<{ status: "unavailable"; instrumentId: string; reason: string }>;
export type CheckpointLaunchStop = Readonly<{
  actionIndex: number;
  label: string;
  launch: CheckpointSettingsLaunch;
}>;
export type CheckpointLaunchCatalogue = Readonly<{
  walkthroughs: readonly Readonly<{
    tapeId: string;
    experimentId: string;
    title: string;
    stops: readonly CheckpointLaunchStop[];
  }>[];
  problems: readonly string[];
}>;

/**
 * Retain every stop, including explicit owner refusals. The injected writer is the only parameter
 * authority: this module contains no scientific formulas, default settings or checkpoint digests.
 */
export function buildCheckpointLaunches(
  catalogue: WalkthroughCatalogue,
  build: (
    experimentId: string,
    settings: Readonly<Record<string, number | string>>,
  ) => CheckpointSettingsLaunch,
): CheckpointLaunchCatalogue {
  return {
    walkthroughs: catalogue.walkthroughs.map((walkthrough) => ({
      tapeId: walkthrough.tapeId,
      experimentId: walkthrough.experimentId,
      title: walkthrough.title,
      stops: walkthrough.checkpoints.map((checkpoint) => {
        const written = build(walkthrough.experimentId, checkpoint.settings);
        const unique =
          walkthrough.checkpoints.filter((other) => other.actionIndex === checkpoint.actionIndex)
            .length === 1;
        const href =
          written.status === "ready" && written.instrumentId === walkthrough.experimentId && unique
            ? withWalkthroughSelection(
                written.href,
                walkthrough.experimentId,
                walkthrough.tapeId,
                checkpoint.actionIndex,
              )
            : null;
        const launch: CheckpointSettingsLaunch =
          written.status === "unavailable"
            ? written
            : href === null
              ? {
                  status: "unavailable",
                  instrumentId: walkthrough.experimentId,
                  reason:
                    "This stop cannot be addressed unambiguously within the laboratory link's size limit.",
                }
              : { ...written, href };
        return { actionIndex: checkpoint.actionIndex, label: checkpoint.label, launch };
      }),
    })),
    problems: [...catalogue.problems],
  };
}
