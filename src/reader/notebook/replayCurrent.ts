import type { ReplayCatalogue } from "./replayCompatibility.ts";
import type { ComparisonReplay } from "./replayEntry.ts";
import type { ReplayViewEnvironment } from "./replayView.ts";

/** Public build inputs are loaded lazily; private evidence never crosses a request boundary. */
export function replayEnvironment(replay: ComparisonReplay): ReplayViewEnvironment {
  const adapter = comparisonReplayAdapter(replay.baseline.experimentId);
  // Sharing one pending load keeps catalogue checks and an explicit run on the same build.
  let owner: ReturnType<typeof adapter.loadCurrentOwner> | null = null;
  const loadOwner = () => (owner ??= adapter.loadCurrentOwner());
  return {
    async loadCatalogue() {
      const [catalogue, current] = await Promise.all([adapter.loadCatalogue(), loadOwner()]);
      return { ...catalogue, identity: current.identity } as ReplayCatalogue;
    },
    async createRunner() {
      const [{ createComparisonReplayRunner }, current] = await Promise.all([
        import("./replayRunner.ts"),
        loadOwner(),
      ]);
      return createComparisonReplayRunner(replay, current);
    },
  };
}

import { comparisonReplayAdapter } from "./comparisonAdapters.ts";
