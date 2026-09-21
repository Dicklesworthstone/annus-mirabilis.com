/**
 * What the German source face must tell a reader about the text it is showing.
 *
 * The owner ruled on am-dl4n criterion 2, selecting verbatim "Show it, labelled a draft":
 * emit the payload and render the German source with a persistent, prominent notice that
 * it is a machine draft corrected against the page images and not human-reviewed. The
 * alternatives "Not until reviewed" and "Behind an explicit opt-in" were declined.
 *
 * THE WORDING IS DERIVED FROM THE RECEIPT, NOT WRITTEN IN A COMPONENT. That is the point
 * of this module and it is a requirement rather than a preference. If a paper ever becomes
 * genuinely reviewed, the page must stop calling it a draft without anyone editing a
 * component and without anyone remembering to. A literal in a face component cannot do
 * that: it says "draft" until a human notices it should not, and the same failure has
 * already happened here in another form, where a coverage report printed "Reviewed ledger
 * on disk" for two machine drafts because presence was `existsSync` and it could never
 * have known anything else.
 *
 * IT ALSO KEYS OFF NOTHING ELSE. Not the ledger filename, which am-wisq is renaming off
 * `-reviewed.txt` this tick, and not the ledger's header line, which am-wisq is changing
 * to "--- MACHINE DRAFT TRANSCRIPTION PAGE n OF m ---". Both of those are moving, and a
 * page that decided what to tell a reader by reading either would have been telling them
 * something different by this evening for no editorial reason at all.
 *
 * The receipt is the right source because it is the layer that records editorial status by
 * construction: `transcription.ledgerStatus`, `transcription.editors`, and the
 * `draftedBy` entry that records who produced the draft, on what basis, under whose
 * authority.
 */

import type { LedgerStatus, Transcription } from "./receiptSchema.ts";

/**
 * Two states, and "present" is deliberately not one of them - the same distinction
 * ledgerPresence had to learn. A ledger existing says nothing about whether a human has
 * read it.
 */
export type SourceFaceReviewState = "machine-draft" | "reviewed";

export type SourceFaceNotice = Readonly<{
  state: SourceFaceReviewState;
  /** The short persistent label. Empty for a reviewed text, which needs no badge. */
  label: string;
  /** The sentence shown beside the text, assembled from the receipt's own fields. */
  body: string;
  /** The receipt fields the wording rests on, so a page can cite rather than paraphrase. */
  ledgerStatus: LedgerStatus;
  /** The drafter's recorded role, when the receipt names one. */
  role?: string | undefined;
  /** The drafter's recorded basis, when the receipt names one. */
  basis?: string | undefined;
  /** Reviewer names recorded on the receipt. Empty is the whole point for a draft. */
  reviewers: readonly string[];
}>;

export class SourceFaceNoticeError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "SourceFaceNoticeError";
  }
}

/** `machine-draft-with-hand-correction` to `machine draft with hand correction`. */
function humanise(role: string): string {
  return role.replace(/-/g, " ").trim();
}

type DraftedByEntry = Readonly<{
  id?: unknown;
  role?: unknown;
  basis?: unknown;
}>;

/**
 * `draftedBy` is recorded in the receipts and is not yet on the `Transcription` type,
 * which belongs to another pane's schema. It is read defensively rather than by widening
 * a type mid-flight, and its absence is not an error: a paper may have a ledger with no
 * drafter entry, and the notice then rests on ledgerStatus and editors alone, which is
 * enough to say the honest thing.
 */
function firstDrafter(transcription: Transcription): DraftedByEntry | undefined {
  const raw = (transcription as unknown as { draftedBy?: unknown }).draftedBy;
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const first = raw[0];
  return typeof first === "object" && first !== null ? (first as DraftedByEntry) : undefined;
}

/**
 * Derives what the source face must say, from the receipt alone.
 *
 * REFUSES A CONTRADICTORY RECEIPT rather than picking a side. `ledgerStatus: reviewed`
 * with no editor recorded is not a state anything can render honestly: one field says a
 * human has read it and the other says nobody is named. Choosing either reading would
 * make the page assert something the receipt does not support, and choosing the generous
 * one would drop the draft label on the strength of a field nobody filled in.
 */
export function sourceFaceNotice(transcription: Transcription): SourceFaceNotice {
  const reviewers = transcription.editors.map((editor) => editor.name).filter((n) => n !== "");
  const status = transcription.ledgerStatus;

  if (status === "reviewed" && reviewers.length === 0) {
    throw new SourceFaceNoticeError(
      "receipt-review-state-inconsistent",
      "Receipt records transcription.ledgerStatus 'reviewed' with no editor in " +
        "transcription.editors. One field claims a human has read this text and the other " +
        "names nobody, so no notice can be rendered honestly. Record the reviewer, or set " +
        "ledgerStatus back to the state the work is actually in.",
    );
  }

  if (status === "reviewed") {
    // No badge. The page stops calling it a draft the moment the receipt does, which is
    // the property this module exists for.
    return {
      state: "reviewed",
      label: "",
      body: "",
      ledgerStatus: status,
      reviewers,
    };
  }

  const drafter = firstDrafter(transcription);
  const role = typeof drafter?.role === "string" ? drafter.role : undefined;
  const basis = typeof drafter?.basis === "string" ? drafter.basis : undefined;

  // Assembled from the receipt's fields. Every clause below is a fact the receipt states,
  // not an editorial flourish, and each disappears or changes when the receipt does.
  const sentences: string[] = [
    role
      ? `This German text is a ${humanise(role)}.`
      : "This German text has not been reviewed by a human.",
  ];
  if (basis) sentences.push(basis.endsWith(".") ? basis : `${basis}.`);
  sentences.push(
    reviewers.length === 0
      ? "No reviewer has checked it against the printed page, and none is recorded on its provenance receipt."
      : `Recorded reviewers: ${reviewers.join(", ")}. Review is not complete.`,
  );
  sentences.push(`Its receipt records the transcription as ${status}.`);

  return {
    state: "machine-draft",
    label: "Machine draft, not reviewed",
    body: sentences.join(" "),
    ledgerStatus: status,
    role,
    basis,
    reviewers,
  };
}

/**
 * True when a face showing this transcription must carry the notice.
 *
 * Exists so a render path can ask the question without re-deriving the rule, and so the
 * guard that makes the notice non-omittable and the component that renders it are reading
 * the same predicate rather than two copies of it.
 */
export function requiresDraftNotice(transcription: Transcription): boolean {
  return sourceFaceNotice(transcription).state === "machine-draft";
}
