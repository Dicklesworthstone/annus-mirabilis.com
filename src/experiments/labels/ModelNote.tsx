/**
 * Expandable model note (am-inst-execution-labels-5ywv). Keyboard-operable
 * via native `details`/`summary`. Renders `ModelNoteData`; does not derive
 * execution state and does not name comparison kinds or parity rungs.
 */
import type { ReactElement } from "react";
import type { ModelNoteData, ModelNoteOutput } from "./modelNoteData.ts";
import "./executionChrome.css";

export type ModelNoteProps = Readonly<{
  data: ModelNoteData;
}>;

type OutputGroup = Readonly<{ key: string; head: ModelNoteOutput; ids: readonly string[] }>;

/**
 * Outputs that share a role, an engine sentence and an owner, as one entry. One entry per output
 * made bm-01's note 50 items and 3,330px tall on a phone, each repeating the same sentence and owner:
 * "Primary output temperature: Host calculation (bm01.acceptedInputs). Owner bm01.acceptedInputs."
 */
function groupOutputs(outputs: readonly ModelNoteOutput[]): OutputGroup[] {
  const groups = new Map<string, { head: ModelNoteOutput; ids: string[] }>();
  for (const output of outputs) {
    const key = `${output.role}\u0000${output.engineSentence}\u0000${output.ownerId}`;
    const group = groups.get(key);
    if (group) group.ids.push(output.outputId);
    else groups.set(key, { head: output, ids: [output.outputId] });
  }
  return [...groups].map(([key, group]) => ({ key, head: group.head, ids: group.ids }));
}

function outputEntry(role: "Primary" | "Secondary", group: OutputGroup): string {
  const noun = group.ids.length === 1 ? "output" : "outputs";
  return `${role} ${noun} ${group.ids.join(", ")}: ${group.head.engineSentence} Owner ${group.head.ownerId}.`;
}

export function ModelNote({ data }: ModelNoteProps): ReactElement {
  const primary = groupOutputs(data.outputs.filter((output) => output.role === "primary"));
  const secondary = groupOutputs(data.outputs.filter((output) => output.role === "secondary"));
  return (
    <details className="model-note">
      <summary>Model note</summary>
      <ul className="model-note-list">
        {primary.map((group) => (
          <li key={group.key}>{outputEntry("Primary", group)}</li>
        ))}
        {secondary.map((group) => (
          <li key={group.key}>{outputEntry("Secondary", group)}</li>
        ))}
        {data.modelVersion !== undefined ? <li>Model version {data.modelVersion}.</li> : null}
        {data.artifactDigest !== undefined ? <li>Artifact digest {data.artifactDigest}.</li> : null}
        {data.constantSetLabel !== undefined ? (
          <li>
            Constant set {data.constantSetLabel}
            {data.constantSetId !== undefined ? ` (${data.constantSetId})` : ""}.
          </li>
        ) : data.constantSetId !== undefined ? (
          <li>Constant set {data.constantSetId}.</li>
        ) : null}
        {data.seed !== undefined ? <li>Seed {data.seed}.</li> : null}
        {data.streamVersion !== undefined ? (
          <li>Stream-semantics version {data.streamVersion}.</li>
        ) : null}
        {data.commonRandomNumbers === true ? (
          <li>This comparison reuses the same seed; it is not an independent trial.</li>
        ) : null}
        <li>Accepted input revision {data.acceptedInputRevision}.</li>
        <li>Snapshot version {data.snapshotVersion}.</li>
        {data.fallbackSentence !== undefined ? <li>{data.fallbackSentence}</li> : null}
        {data.modelChoiceSentence !== undefined ? <li>{data.modelChoiceSentence}</li> : null}
        {data.viewSubstitutionSentence !== undefined ? (
          <li>{data.viewSubstitutionSentence}</li>
        ) : null}
        {(data.paritySentences ?? []).map((sentence) => (
          <li key={sentence}>{sentence}</li>
        ))}
        <li>Not modeled: {data.notModeled}</li>
        {data.showTheCodeHref !== undefined ? (
          <li>
            <a href={data.showTheCodeHref}>Show the code</a>
          </li>
        ) : null}
      </ul>
    </details>
  );
}
