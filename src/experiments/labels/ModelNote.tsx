/**
 * Expandable model note (am-inst-execution-labels-5ywv). Keyboard-operable
 * via native `details`/`summary`. Renders `ModelNoteData`; does not derive
 * execution state and does not name comparison kinds or parity rungs.
 */
import type { ReactElement } from "react";
import type { ModelNoteData } from "./modelNoteData.ts";
import "./executionChrome.css";

export type ModelNoteProps = Readonly<{
  data: ModelNoteData;
}>;

export function ModelNote({ data }: ModelNoteProps): ReactElement {
  const primary = data.outputs.filter((output) => output.role === "primary");
  const secondary = data.outputs.filter((output) => output.role === "secondary");
  return (
    <details className="model-note">
      <summary>Model note</summary>
      <ul className="model-note-list">
        {primary.map((output) => (
          <li key={`primary-${output.outputId}`}>
            Primary output {output.outputId}: {output.engineSentence} Owner {output.ownerId}.
          </li>
        ))}
        {secondary.map((output) => (
          <li key={`secondary-${output.outputId}`}>
            Secondary output {output.outputId}: {output.engineSentence} Owner {output.ownerId}.
          </li>
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
