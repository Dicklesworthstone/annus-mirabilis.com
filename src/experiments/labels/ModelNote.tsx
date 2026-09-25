/**
 * Expandable model note (am-inst-execution-labels-5ywv). Keyboard-operable
 * via native `details`/`summary`. Renders `ModelNoteData`; does not derive
 * execution state and does not name comparison kinds or parity rungs.
 *
 * IN PLAIN WORDS (dispatch 212). The note carries the artifact identity AGENTS.md puts here, and it
 * used to carry it as the store's own identifiers: "Primary outputs radiusCurvatureMagnetic, ...,
 * lorentzFactor: Host calculation (electron). Owner electron. Accepted input revision 1. Snapshot
 * version 1." Measured on live over the 41 labs, "owner" 154 times, "revision" 49 and "snapshot"
 * 41. Every value is still here; each is now said in words, with the identifier kept in <code>
 * where a permalink or a bug report needs it.
 */
import { Fragment, type ReactElement, type ReactNode } from "react";
import { QUANTITY_LABELS } from "../../generated/quantity-labels.ts";
import type { ModelNoteData, ModelNoteOutput } from "./modelNoteData.ts";
import { OUTPUT_LABELS } from "./outputLabels.ts";
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

/**
 * An output's name in words: the quantity registry's name when the output id is a registered
 * quantity (content/quantities, through the generated client-safe map); else the output's own
 * authored label (outputLabels.ts); else its id spelled out ("plotSampleMean" as "Plot sample
 * mean"), which still reads better than camelCase. The id itself follows in code.
 */
export function outputName(id: string): string {
  const named = QUANTITY_LABELS[id] ?? OUTPUT_LABELS[id];
  if (named) return named;
  const words = id
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .split(" ")
    .map((word) => SPELLED[word] ?? (/^[A-Z][a-z]+$/.test(word) ? word.toLowerCase() : word))
    .join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Words an id spells that keep their own form: names stay capitalized ("kineticEnergyNewtonian" is
 * "Kinetic energy Newtonian", not "newtonian"), and abbreviations keep their letters.
 */
const SPELLED: Readonly<Record<string, string>> = {
  Newtonian: "Newtonian",
  Galilean: "Galilean",
  Wien: "Wien",
  Planck: "Planck",
  Boltzmann: "Boltzmann",
  Lorentz: "Lorentz",
  Ampere: "Ampère",
  Faraday: "Faraday",
  Rms: "RMS",
  Msd: "MSD",
  Ev: "eV",
};

/** "a, b and c", each part already rendered. */
function listed(parts: readonly ReactNode[]): ReactNode {
  return parts.map((part, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list rendered once, never reordered.
    <Fragment key={i}>
      {i === 0 ? null : i === parts.length - 1 ? " and " : ", "}
      {part}
    </Fragment>
  ));
}

function outputEntry(group: OutputGroup): ReactNode {
  const names = group.ids.map((outputId) => (
    <>
      {outputName(outputId)} (<code>{outputId}</code>)
    </>
  ));
  return (
    <>
      {listed(names)}
      {group.head.role === "secondary" ? " (secondary results)" : null}: {group.head.engineSentence}{" "}
      Computed in <code>{group.head.ownerId}</code>.
    </>
  );
}

export function ModelNote({ data }: ModelNoteProps): ReactElement {
  const primary = groupOutputs(data.outputs.filter((output) => output.role === "primary"));
  const secondary = groupOutputs(data.outputs.filter((output) => output.role === "secondary"));
  return (
    <details className="model-note">
      <summary>Model note</summary>
      <ul className="model-note-list">
        {primary.map((group) => (
          <li key={group.key}>{outputEntry(group)}</li>
        ))}
        {secondary.map((group) => (
          <li key={group.key}>{outputEntry(group)}</li>
        ))}
        {data.modelVersion !== undefined ? (
          <li>Version of the model: {data.modelVersion}.</li>
        ) : null}
        {data.artifactDigest !== undefined ? (
          <li>Fingerprint of the exact program that ran: {data.artifactDigest}.</li>
        ) : null}
        {data.constantSetLabel !== undefined ? (
          <li>
            Physical constants: {data.constantSetLabel}
            {data.constantSetId !== undefined ? (
              <>
                {" "}
                (<code>{data.constantSetId}</code>)
              </>
            ) : null}
            .
          </li>
        ) : data.constantSetId !== undefined ? (
          <li>
            Physical constants: <code>{data.constantSetId}</code>.
          </li>
        ) : null}
        {data.seed !== undefined ? (
          <li>Seed {data.seed}: with the same settings, the same seed replays the same trial.</li>
        ) : null}
        {data.streamVersion !== undefined ? (
          <li>
            Random-number stream version {data.streamVersion}, which a replay with this seed also
            needs.
          </li>
        ) : null}
        {data.commonRandomNumbers === true ? (
          <li>This comparison reuses the same seed; it is not an independent trial.</li>
        ) : null}
        {/* The two run identities in one sentence. The numbers stay: they are what a permalink or a
            bug report needs to name the result a reader saw. */}
        <li>
          Computed from the settings last applied (settings revision {data.acceptedInputRevision},
          result {data.snapshotVersion}).
        </li>
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
