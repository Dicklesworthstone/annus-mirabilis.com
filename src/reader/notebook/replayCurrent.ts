import type { ReplayCatalogue } from "./replayCompatibility.ts";
import type { ComparisonReplay } from "./replayEntry.ts";
import type { ReplayViewEnvironment } from "./replayView.ts";

/** Public build inputs are loaded lazily; private evidence never crosses a request boundary. */
export function replayEnvironment(replay: ComparisonReplay): ReplayViewEnvironment {
  return {
    async loadCatalogue() {
      const module = await import("../../generated/notebook-replay.json");
      return module.default as ReplayCatalogue;
    },
    async createRunner() {
      const [{ createComparisonReplayRunner }, { createBm01BrowserChannel }, prepared, catalogue] =
        await Promise.all([
          import("./replayRunner.ts"),
          import("../../experiments/bm01/browser.ts"),
          import("../../generated/bm01-example.json"),
          import("../../generated/notebook-replay.json"),
        ]);
      return createComparisonReplayRunner(replay, {
        example: prepared.default,
        identity: catalogue.default.identity,
        workerFactory: createBm01BrowserChannel,
      });
    },
  };
}
