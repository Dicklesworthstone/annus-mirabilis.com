/**
 * The single, one-wording notice for a catalogue id whose manifest is not
 * yet compiled (am-inst-registry-dispatcher-66l0). "In preparation" is
 * honest only if it shows nothing that looks like a result: no controls,
 * no numbers, no look-alike scene. `am-rel-preview-policy-cf6g` imports
 * this same component for instruments of unpublished papers, so a reader
 * never sees two phrasings for one state.
 */

export interface InPreparationNoticeProps {
  readonly id: string;
  readonly question?: string | undefined;
  readonly sourceHref?: string | undefined;
}

export function InPreparationNotice({ id, question, sourceHref }: InPreparationNoticeProps) {
  return (
    <div data-testid="in-preparation-notice" data-instrument-id={id} role="status">
      <p>This experiment is in preparation.</p>
      {question ? <p>{question}</p> : null}
      {sourceHref ? <a href={sourceHref}>Read the source passage</a> : null}
    </div>
  );
}
