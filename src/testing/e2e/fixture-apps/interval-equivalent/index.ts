/**
 * Interval Family Interactive Fixture Application (am-a11y-action-contracts-k75g).
 *
 * Provides an interactive browser test fixture running the interval equivalent component
 * against the real instance store and command classes without a mocked framework.
 */

import { createElement, useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import { hashCommand, hashOutputs } from "../../../../a11y/actions/commandBuilder.ts";
import {
  type IntervalBounds,
  IntervalEquivalent,
} from "../../../../a11y/actions/families/interval/IntervalEquivalent.tsx";
import { fixtureIntervalContract } from "../../../../a11y/actions/fixtures.ts";
import type { CanonicalActionCommand } from "../../../../a11y/actions/types.ts";
import {
  BM06_DEFAULTS,
  BM06_OUTPUTS,
  BM06_PARAMETER_CLASSES,
} from "../../../../experiments/bm06/definition.ts";
import { createInstanceStore } from "../../../../experiments/store/instanceStore.ts";

export function IntervalEquivalentFixtureApp() {
  const [store] = useState(() => {
    const s = createInstanceStore({
      experimentId: "bm-06",
      instanceId: "instance-interval-equivalent-fixture",
      initialParameters: BM06_DEFAULTS,
      parameterClasses: BM06_PARAMETER_CLASSES,
      outputs: BM06_OUTPUTS,
      allowPartial: true,
    });
    // Initial setup publication
    const token = s.issue("setup-change");
    s.publish({
      ...token,
      stepIndex: 0,
      simulationTime: 0,
      final: true,
      outputs: [],
    });
    return s;
  });

  const [snapshotVersion, setSnapshotVersion] = useState<number>(1);
  const [inputRevision, setInputRevision] = useState<number>(0);
  const [acceptedInputRevision, setAcceptedInputRevision] = useState<number>(0);
  const [lastCommandHash, setLastCommandHash] = useState<string>("");
  const [lastOutputsHash, setLastOutputsHash] = useState<string>("");
  const [runId, setRunId] = useState<string>("instance-interval-equivalent-fixture/run/1");

  const handleCommitInterval = useCallback(
    (bounds: IntervalBounds, command: CanonicalActionCommand) => {
      const cmdHash = hashCommand(command);
      setLastCommandHash(cmdHash);
      setInputRevision((r) => r + 1);

      const token = store.issue("measurement-change", {
        lower: bounds.lower,
        upper: bounds.upper,
      });

      const width = Math.max(0, bounds.upper - bounds.lower);
      const probValue = Math.min(1, Math.round(width * 0.25 * 1000) / 1000);

      const published = store.publish({
        ...token,
        stepIndex: 1,
        simulationTime: 1.0,
        final: true,
        outputs: [
          {
            quantityId: "intervalProbability",
            status: "value",
            unit: "1",
            semanticKind: "probability",
            ownerId: "diffusion.intervalProbability",
            value: probValue,
          },
        ],
      });

      if (published.accepted) {
        const snap = store.getSnapshot();
        const ver = snap.accepted?.snapshotVersion ?? snapshotVersion + 1;
        setSnapshotVersion(ver);
        setAcceptedInputRevision((r) => r + 1);
        if (snap.accepted?.runId) {
          setRunId(snap.accepted.runId);
        }
        const outHash = hashOutputs({ intervalProbability: probValue });
        setLastOutputsHash(outHash);
      }
    },
    [store, snapshotVersion],
  );

  return createElement(
    "div",
    {
      id: "interval-fixture-root",
      "data-testid": "interval-fixture-root",
      "data-instrument-id": "bm-06",
      "data-instance-id": "instance-interval-equivalent-fixture",
      "data-run-id": runId,
      "data-snapshot-version": String(snapshotVersion),
      "data-input-revision": String(inputRevision),
      "data-accepted-input-revision": String(acceptedInputRevision),
      "data-pending": "false",
      "data-execution-label": "host",
      "data-last-command-class": "measurement-change",
      "data-last-command-hash": lastCommandHash,
      "data-last-outputs-hash": lastOutputsHash,
    },
    createElement(IntervalEquivalent, {
      contract: fixtureIntervalContract,
      initialInterval: { lower: -1.0, upper: 1.0 },
      onCommitInterval: handleCommitInterval,
    }),
  );
}

// Auto-mount in browser environments
if (typeof document !== "undefined") {
  const container =
    document.getElementById("app") || document.body.appendChild(document.createElement("div"));
  container.id = "app";
  const root = createRoot(container);
  root.render(createElement(IntervalEquivalentFixtureApp));
}
