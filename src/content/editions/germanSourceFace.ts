/**
 * The German source face: the continuous visitor-facing source text, assembled from the
 * reviewed ledger and carrying the notice the receipt requires (am-dl4n criterion 2).
 *
 * The owner ruled "Show it, labelled a draft". This module is what makes the first of
 * those two words true; `sourceFaceNotice` is what makes the second true.
 *
 * THE LEDGER PATH COMES FROM THE RECEIPT, NOT FROM A FILENAME CONVENTION. am-wisq is
 * renaming the ledgers off `-reviewed.txt` while this is being written, and a module that
 * reconstructed `public/papers/transcripts/<key>-reviewed.txt` would stop finding any of
 * them the moment the rename lands. `transcription.ledgerPath` is the receipt's own record
 * of where its ledger is, so following it means the rename carries this module with it and
 * nobody has to remember there was a second place the path was written down.
 *
 * AND A RECEIPT THAT NAMES A FILE THAT IS NOT THERE REFUSES LOUDLY. That is the failure
 * mode the rename can actually produce - a ledger moved and a receipt not updated - and it
 * must not degrade into "this paper has no source yet", which is a sentence a reader would
 * believe. An absent ledgerPath is a different thing and is NOT an error: it means no
 * ledger has been made for that paper, which is true of three of the five.
 *
 * THESE ARE NOT SourceBlock RECORDS AND MUST NOT BE PRESENTED AS THEM. A SourceBlock
 * carries a facsimile locator - a PDF page index and a printed page - because a source
 * block is anchored evidence, and the schema requires at least one. The ledger segmenter
 * strips page markers before segmenting, so a proposed block has none.
 *
 * I tried to recover them by finding each block's text back in the raw ledger and reading
 * the nearest preceding page anchor. It resolves 233 of 245 blocks across the three
 * papers and fails on twelve, mostly equations whose text is normalised during
 * segmentation. Filling those twelve with a guess would be manufacturing provenance, and
 * a locator pointing at the wrong page is worse than no locator at all: it is a false
 * citation of the facsimile.
 *
 * So the draft face renders this text WITHOUT per-block locators and does not pretend to
 * be the anchored source layer. Anchoring it properly means teaching segmentLedger to
 * carry page markers through segmentation, which is a change to the editions pane's
 * module and is follow-on work, not something to fake here.
 *
 * NOTICE AND BLOCKS ARE ONE VALUE ON PURPOSE. `notice` is not optional on the returned
 * type, so no caller can obtain the German text without also holding the sentence that
 * qualifies it. That is requirement 3 expressed in the type rather than in a convention;
 * the guard that proves a renderer cannot drop it lives beside the face component.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { RouteSlug } from "../ids.ts";
import { parseReceipt } from "../provenance/parseReceipt.ts";
import { type SourceFaceNotice, sourceFaceNotice } from "../provenance/sourceFaceNotice.ts";
import { type BlockPages, blockStartPages } from "./blockPages.ts";
import { type JoinedBlock, joinPageContinuations } from "./joinContinuations.ts";
import { PAPER_BIB_KEYS } from "./ledgerPresence.ts";
import { segmentLedger } from "./segmentLedger.ts";

export type GermanSourceFace = Readonly<{
  slug: RouteSlug;
  bibKey: string;
  /** Never optional. Holding the text means holding what qualifies it. */
  notice: SourceFaceNotice;
  blocks: readonly JoinedBlock[];
  /** The printed page each block starts on, from the ledger's own page anchors (blockPages.ts). */
  printedPages: BlockPages;
}>;

export class GermanSourceFaceError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "GermanSourceFaceError";
  }
}

/**
 * Builds the German source face for a paper, or returns null when the paper genuinely has
 * no ledger yet.
 *
 * null and a refusal are different answers and the difference matters to a reader: null
 * means "no source text has been transcribed for this paper", which the existing face
 * already says honestly, and a refusal means "the records disagree with the disk", which
 * nobody should paper over with the same sentence.
 */
export function loadGermanSourceFace(
  slug: RouteSlug,
  root: string = process.cwd(),
): GermanSourceFace | null {
  const bibKey = PAPER_BIB_KEYS[slug];
  const receiptPath = join(root, "docs", "provenance", `${bibKey}.md`);
  if (!existsSync(receiptPath)) return null;

  const parsed = parseReceipt(readFileSync(receiptPath, "utf8"), receiptPath);
  const frontMatter = parsed.frontMatter;
  if (!frontMatter) {
    throw new GermanSourceFaceError(
      "receipt-unparseable",
      `Provenance receipt for ${bibKey} did not parse, so nothing can be said about the ` +
        `status of its source text. Rendering it unlabelled is not an option.`,
    );
  }

  const transcription = frontMatter.transcription;
  // Throws receipt-review-state-inconsistent on a contradictory receipt, which is what
  // should happen: a page cannot be rendered honestly from records that disagree.
  const notice = sourceFaceNotice(transcription);

  // `not-started` is the receipt saying no ledger has been made. Its ledgerPath is then a
  // PLAN rather than a record - ap-17-891 and ap-19-289 both name a file nobody has
  // written yet - so the path is not consulted and the face reports the honest absence.
  //
  // This is checked BEFORE the path deliberately. My first version refused those two
  // papers with ledger-path-missing, which read as "the records disagree with the disk"
  // when the records agree perfectly: they say the work has not begun. A refusal that
  // fires on a correct state is worse than no refusal, because it trains a reader to
  // route around the one that matters.
  if (transcription.ledgerStatus === "not-started") return null;

  const ledgerRelative = transcription.ledgerPath;
  if (ledgerRelative === undefined || ledgerRelative.trim() === "") return null;

  const ledgerPath = join(root, ledgerRelative);
  if (!existsSync(ledgerPath)) {
    throw new GermanSourceFaceError(
      "ledger-path-missing",
      `The receipt for ${bibKey} records transcription.ledgerPath "${ledgerRelative}", and ` +
        `nothing is there. A moved ledger with a stale receipt is the expected cause. This ` +
        `refuses rather than reporting the paper as having no source text, because a reader ` +
        `would believe that sentence and it would be false.`,
    );
  }

  const ledgerText = readFileSync(ledgerPath, "utf8");
  const segmented = segmentLedger({ ledgerText });
  if (segmented.status === "absent") return null;
  // A paragraph the page broke is one paragraph here; no id moves (joinContinuations.ts).
  const blocks = joinPageContinuations(segmented.blocks);

  return {
    slug,
    bibKey,
    notice,
    blocks,
    printedPages: blockStartPages(ledgerText, blocks),
  };
}
