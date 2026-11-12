"use client";
import { useId, useRef, useState } from "react";
import {
  type ApplyFailure,
  failureCode,
  failureFromThrown,
} from "../../experiments/results/applyFailure.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import inferenceBuild from "../../generated/inference-workbench.json";
import { evidenceFromAccepted, type PinnedInferenceEvidence } from "./acceptedEvidence.ts";
import { InferenceCaseWorkbench } from "./FamilyWorkbench.tsx";

/** Explicit local handoff. Only this mounted placement retains the bounded observation copy. */
export function AcceptedEvidenceWorkbench({
  snapshot,
  sourceDigest,
  ready,
}: {
  snapshot: AcceptedSnapshot;
  sourceDigest: string;
  ready: boolean;
}) {
  const id = useId();
  const pinButton = useRef<HTMLButtonElement>(null);
  const [pinned, setPinned] = useState<PinnedInferenceEvidence | null>(null);
  const [pinRevision, setPinRevision] = useState(0);
  const [failure, setFailure] = useState<ApplyFailure | null>(null);
  const changed =
    pinned &&
    (pinned.source.instanceId !== snapshot.instanceId ||
      pinned.source.runId !== snapshot.runId ||
      pinned.source.snapshotVersion !== snapshot.snapshotVersion);
  function pin() {
    try {
      const next = evidenceFromAccepted(snapshot, sourceDigest);
      setPinned(next);
      setPinRevision((revision) => revision + 1);
      setFailure(null);
    } catch (caught) {
      setFailure(
        failureFromThrown(caught, "The accepted observations could not enter this workbench."),
      );
    }
  }
  return (
    <section className="accepted-evidence-workbench" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>What can these observations tell you?</h3>
      <p>
        Keep the accepted record fixed and explore which extra information separates its possible
        explanations. The workbench uses the displayed observations, not draft edits or a pending
        calculation. It starts no new physical trial.
      </p>
      <div className="actions">
        <button
          ref={pinButton}
          type="button"
          className="secondary"
          disabled={!ready}
          aria-expanded={Boolean(pinned)}
          aria-controls={`${id}-case`}
          onClick={pin}
        >
          {pinned ? "Replace with current accepted observations" : "Explore accepted observations"}
        </button>
        {pinned && (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setPinned(null);
              setFailure(null);
              pinButton.current?.focus();
            }}
          >
            Close pinned workbench
          </button>
        )}
      </div>
      {failure && (
        <p
          role="alert"
          className="notice error"
          data-apply-failure={failure.kind}
          data-refusal-code={failureCode(failure)}
        >
          {failure.text}{" "}
          {pinned
            ? "The previous pinned observations and inference are unchanged."
            : "The laboratory's accepted result is unchanged."}
        </p>
      )}
      {changed && (
        <p className="notice" data-pinned-source-changed>
          The source laboratory has a newer accepted result. This workbench still uses the pinned
          observations below. Replace them explicitly to start a new inference question.
        </p>
      )}
      <div id={`${id}-case`}>
        {pinned && (
          <div
            data-pinned-observation-digest={pinned.evidence.observationDigest}
            data-source-instance-id={pinned.source.instanceId}
            data-source-run-id={pinned.source.runId}
            data-source-snapshot-version={pinned.source.snapshotVersion}
            data-evidence-provenance={pinned.provenance}
          >
            <p role="status">
              Pinned {pinned.evidence.increments.length / pinned.evidence.d} synthetic increments
              from {pinned.source.experimentId.toUpperCase()}, run{" "}
              <code>{pinned.source.runId}</code>, accepted snapshot {pinned.source.snapshotVersion}.
              The generating molecular number, radius, diffusivity and localization-noise variance
              are not supplied to this inference.
            </p>
            <InferenceCaseWorkbench
              key={pinRevision}
              evidence={pinned.evidence}
              sourceDigest={inferenceBuild.sourceDigest}
            />
          </div>
        )}
      </div>
      <p className="fine">
        These are synthetic laboratory observations. Imported measurements keep their separate
        calibration and inference workflow. The pinned record stays only in this open page; closing
        it leaves the source laboratory unchanged.{" "}
        <a href="/lab/what-can-you-infer/">Read the fixed worked examples and assumptions.</a>
      </p>
    </section>
  );
}
