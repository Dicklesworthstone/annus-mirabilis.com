/**
 * WHAT THE EMITTED HTML OF A READING FACE MUST AND MUST NOT CARRY.
 *
 * am-edn-alignment-tooling-do1 section G specifies five scans for the pipeline's `static-html`
 * stage. Audited 2026-10-20 against the stage as written: it performed two of them, over one
 * route, and both of the two were wrong in the direction that reads as a pass.
 *
 *   section G asks for                                   the stage did
 *   ---------------------------------------------------  --------------------------------------
 *   no ledger markers or running heads                   a marker regex keyed on REVIEWED
 *   no raw LaTeX outside KaTeX <annotation>               matched $$ and \[ over the whole file
 *   lang attributes on German and English content        nothing
 *   every in-scope anchor id present                     nothing
 *   a draft marker where units are not reviewed          nothing (and see scan 5 below)
 *
 * The marker regex was the third copy of a rule two other modules had already been bitten by and
 * fixed: `ledgerPresence.ts` lost every page of every ledger when drafts began opening MACHINE
 * DRAFT, and `segmentLedger.ts` carries a docblock saying, at length, that the detector must match
 * the GRAMMAR and never the status word, because a detector that fails to match leaks furniture
 * into the edition. All four shipping ledgers are `-machine-draft.txt` and open
 * `--- MACHINE DRAFT TRANSCRIPTION PAGE n OF m ---`, so the stage's own regex could not have
 * matched a leak from any ledger that exists. This module imports the owned pattern instead of
 * writing a fourth.
 *
 * The LaTeX scan read the whole file, where a match proves nothing: one relativity face carries
 * 505 KaTeX `<annotation>` elements and 1,213 flight-payload chunks, all legitimately full of TeX,
 * and 351 `\frac` among them. See `readerVisibleText` for what is removed and why each removal was
 * needed.
 *
 * SCAN 5 IS DELIBERATELY THE INVERSE OF WHAT SECTION G ASKS. Section G wants "a draft marker
 * present exactly where units are not `reviewed`". `docs/DECISIONS.md`
 * D-2026-09-25-no-review-status-banners supersedes that: the owner chose that the reading faces
 * carry no review-status banner, chip or credit line, and its "What it supersedes" list names "the
 * German face's draft label" outright. Implementing section G as written would make the pipeline
 * demand copy the owner removed. So this scan asserts the retired banners are ABSENT, which keeps
 * a rejected design from creeping back under a passing suite, and the decision is cited at the
 * scan.
 */

import {
  LEDGER_PAGE_MARKER_REGEX,
  parseSplitTranslationUnitId,
} from "../checks/structural/structural.ts";
import { KNOWN_TAG_NAMES } from "../ledger/ledgerTokenizer.ts";

export const STATIC_HTML_SCAN_BEAD_ID = "am-edn-alignment-tooling-do1";

/** Which reading face the HTML belongs to, which decides the language and anchor rules. */
export type ScannedFace = "german" | "english" | "gloss" | "parallel" | "results" | "split";

export type StaticHtmlFindingCode =
  | "static-html-ledger-page-marker"
  | "static-html-ledger-tag"
  | "static-html-running-head"
  | "static-html-raw-latex"
  | "static-html-document-language"
  | "static-html-german-without-lang"
  | "static-html-anchor-missing"
  | "static-html-retired-review-banner";

export type StaticHtmlFinding = Readonly<{
  code: StaticHtmlFindingCode;
  /** One line a reader of the pipeline summary can act on. */
  message: string;
  /** The offending text, clipped, so a finding can be checked without re-running the scan. */
  sample?: string | undefined;
}>;

/**
 * What the scan looked at. Printed beside the verdict because a scan of nothing and a clean scan
 * are the same green, and this stage has already shipped one of each.
 */
export type StaticHtmlCensus = Readonly<{
  bytes: number;
  readerVisibleBytes: number;
  /** `id` attributes the page declares, which is the population an anchor can land in. */
  declaredIds: number;
  /** In-scope anchors asked for, and how many resolved. */
  anchorsExpected: number;
  anchorsResolved: number;
  /** Elements carrying German source text, and how many declared `lang="de"`. */
  germanTextElements: number;
}>;

export type StaticHtmlScanResult = Readonly<{
  findings: readonly StaticHtmlFinding[];
  examined: StaticHtmlCensus;
  /** Measured facts that are not failures, so they are reported rather than dropped. */
  notes: readonly string[];
}>;

const SCRIPT = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
const STYLE = /<style\b[^>]*>[\s\S]*?<\/style>/gi;
const ANNOTATION = /<annotation\b[^>]*>[\s\S]*?<\/annotation>/gi;
const PRE = /<pre\b[^>]*>[\s\S]*?<\/pre>/gi;
const CODE = /<code\b[^>]*>[\s\S]*?<\/code>/gi;
const ANY_TAG = /<[^>]*>/g;

/**
 * The text a reader actually reads, which is the only population the LaTeX and furniture rules
 * are about. Five removals, and the last four were each found by this scan misfiring rather than
 * by review; the counts are from the four papers' faces in `out/`, measured 2026-10-20.
 *
 *  - `<script>`: Next.js pushes the flight payload into the page as script content. One relativity
 *    face carries 1,213 chunks of it, TeX source included.
 *  - `<style>`: same shape, and cheap to remove.
 *  - `<annotation>`: KaTeX emits the TeX source of every formula into the MathML
 *    `<annotation encoding="application/x-tex">`. That is the accessible form of the formula, not
 *    a rendering failure. 505 of them on one face.
 *  - ATTRIBUTE VALUES, removed by stripping tags whole. `data-latex="\frac{a}{b}"` is the equation
 *    explorer's own input. A version of this scan that stripped only elements reported 75 pages,
 *    every single one of them a `data-latex` attribute.
 *  - `<pre>` and `<code>`: the show-the-code feature prints the kernel's real source as reader
 *    text, on purpose, and a JavaScript template literal `${nuMax}` matches an inline-math `$…$`
 *    pattern. Nine lab and embed pages reported that way. TeX inside a code listing is not a
 *    rendering failure either.
 *
 * With all five removed, the three LaTeX patterns below match on 2 of the 759 built pages and
 * both are the same real defect, so the instrument is proved in both directions over the whole
 * shipped population rather than on a fixture.
 */
export function readerVisibleText(html: string): string {
  const stripped = html
    .replace(SCRIPT, " ")
    .replace(STYLE, " ")
    .replace(ANNOTATION, " ")
    .replace(PRE, " ")
    .replace(CODE, " ")
    .replace(ANY_TAG, " ");
  return decodeEntities(stripped);
}

/** The entities React writes, decoded, so `&#x27;` does not hide a match or make a false one. */
function decodeEntities(text: string): string {
  return text
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function clip(text: string, at: number, radius = 90): string {
  const lo = Math.max(0, at - radius);
  return text
    .slice(lo, at + radius)
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------- 1. ledger furniture

/**
 * `[[…]]` is the ledger's own markup and none of it may reach a reader. The vocabulary is
 * `KNOWN_TAG_NAMES`, which the ledger tokenizer owns and which already lists `RUNNING-HEAD` and
 * `PAGE-NUMBER`, so section G's "running heads" clause is answered through the owner's own
 * tag set rather than through a guess at what a running head looks like in prose.
 *
 * WHICH HALF OF THE QUESTION THIS ANSWERS. An UNTAGGED running head is the bare line
 * `A. Einstein.`, which is not distinguishable from the printed author line that every paper's
 * masthead legitimately carries: `DEFAULT_RUNNING_HEAD_PATTERNS` anchors on a whole line and the
 * reader-visible text of a face has no lines. So this scan catches a tagged running head and the
 * page marker, and does not claim to catch an untagged one. The tagged form is the one a ledger
 * can actually produce, because `DRAFT_REPAIRS` requires a running head to be marked before it is
 * removed.
 */
export function scanLedgerFurniture(visible: string): StaticHtmlFinding[] {
  const findings: StaticHtmlFinding[] = [];
  const marker = LEDGER_PAGE_MARKER_REGEX.exec(visible);
  if (marker) {
    findings.push({
      code: "static-html-ledger-page-marker",
      message:
        "A ledger page marker reached the reader. Scan-page furniture belongs in the ledger " +
        "and the receipt, never in the continuous edition.",
      sample: clip(visible, marker.index),
    });
  }
  const tag = /\[\[([A-Za-z0-9_/-]+)(?:\s[^\]]*)?\]\]/g;
  for (let hit = tag.exec(visible); hit !== null; hit = tag.exec(visible)) {
    const name = (hit[1] ?? "").replace(/^\//, "");
    if (!KNOWN_TAG_NAMES.has(name) && !KNOWN_TAG_NAMES.has(hit[1] ?? "")) continue;
    const running = name === "RUNNING-HEAD" || name === "PAGE-NUMBER";
    findings.push({
      code: running ? "static-html-running-head" : "static-html-ledger-tag",
      message: `The ledger tag [[${hit[1]}]] reached the reader.`,
      sample: clip(visible, hit.index),
    });
    if (findings.length >= 20) break;
  }
  return findings;
}

// ---------------------------------------------------------------- 2. raw LaTeX

/**
 * Raw mathematics in reader text. "Malformed mathematics fails publication; raw `$LaTeX$` is
 * never visible to a reader" is a product rule, not a style preference, so this is the scan with
 * the clearest consequence and it is the one that found a live defect.
 *
 * All three patterns are general forms rather than a curated token list, because a list goes
 * stale: measured over all 759 built pages after the five removals in `readerVisibleText`, they
 * matched 2 pages and nothing else.
 */
const RAW_LATEX = [
  { name: "an inline or display delimiter", pattern: /\$\$|\\\(|\\\)|\\\[|\\\]/ },
  { name: "a control sequence", pattern: /\\[a-zA-Z]{2,}/ },
  { name: "dollar-delimited mathematics", pattern: /\$[^$\s][^$\n]{0,80}\$/ },
];

export function scanRawLatex(visible: string): StaticHtmlFinding[] {
  const findings: StaticHtmlFinding[] = [];
  for (const { name, pattern } of RAW_LATEX) {
    const hit = pattern.exec(visible);
    if (!hit) continue;
    findings.push({
      code: "static-html-raw-latex",
      message: `Reader-visible text carries ${name}, so a reader is shown LaTeX source.`,
      sample: clip(visible, hit.index),
    });
  }
  return findings;
}

// ---------------------------------------------------------------- 3. content language

/**
 * The `id` attributes the page declares, which is what a URL fragment can land on.
 *
 * ANCHORED ON PURPOSE. A bare `id="x"` search also matches `data-block-id="x"`,
 * `data-sentence-id="x"`, `data-footnote-id="x"` and `data-translation-unit-id="x"`, every one of
 * which is a data attribute and not a fragment target. The first measurement of anchor coverage
 * here used the bare form and over-reported, which is the direction an unanchored pattern always
 * fails in: it matches the prose about the thing.
 */
export function declaredIds(html: string): Set<string> {
  const ids = new Set<string>();
  const pattern = /(?<![-\w])id="([^"]+)"/g;
  for (let hit = pattern.exec(html); hit !== null; hit = pattern.exec(html)) {
    if (hit[1] !== undefined) ids.add(hit[1]);
  }
  return ids;
}

/** Every opening tag that carries the given attribute, as written. */
function tagsWithAttribute(html: string, attribute: string): string[] {
  const pattern = new RegExp(`<[a-zA-Z][^>]*\\s${attribute}="[^"]*"[^>]*>`, "g");
  return html.match(pattern) ?? [];
}

function langOf(tag: string): string | undefined {
  return /\slang="([^"]*)"/.exec(tag)?.[1];
}

/**
 * German text declares its language; English text inherits the document's.
 *
 * Every face is served inside `<html lang="en">`, so an English paragraph needs no attribute and
 * a German one needs `lang="de"` or a screen reader pronounces Einstein's German as English. That
 * asymmetry is why this scan is one-sided rather than two.
 *
 * THE POPULATION IS THE ELEMENT THAT CARRIES THE PROSE, and getting it right took two tries.
 * Keyed on `data-block-id`, it reddened 98 correct records on relativity: the "Align sentences"
 * control carries a block id and is an English button, and a printed display carries
 * `data-kind="equation"` and must NOT be `lang="de"`, because a formula is not German prose and
 * tagging it would make a screen reader read the symbols as German words. So the population is
 * elements with a `data-kind` that is not `equation`, plus the masthead and closing blocks, which
 * carry a block id and no kind. Sentences are excluded deliberately: a sentence span sits inside
 * its paragraph and inherits `de` from it.
 */
/** The faces that put German in front of a reader, and so must declare it. */
const SHOWS_GERMAN: ReadonlySet<ScannedFace> = new Set<ScannedFace>([
  "german",
  "parallel",
  "gloss",
]);

export function scanContentLanguage(html: string, face: ScannedFace): StaticHtmlFinding[] {
  const findings: StaticHtmlFinding[] = [];
  const documentLang = /<html[^>]*\slang="([^"]*)"/.exec(html)?.[1];
  if (documentLang === undefined || documentLang.length === 0) {
    findings.push({
      code: "static-html-document-language",
      message: "The document declares no language, so nothing inherits one.",
    });
  }
  if (!SHOWS_GERMAN.has(face)) return findings;

  for (const tag of germanTextTags(html)) {
    if (langOf(tag) === "de") continue;
    findings.push({
      code: "static-html-german-without-lang",
      message:
        "A German source block declares no German language, so it inherits the document's " +
        "English and is pronounced as English.",
      sample: tag.slice(0, 180),
    });
    if (findings.length >= 20) break;
  }
  return findings;
}

/**
 * The elements that carry German source prose. See `scanContentLanguage` for why these.
 *
 * Three populations, because the faces do not share one markup. The source faces mark a block
 * with `data-kind` (the printed displays among them, excluded above), the masthead and closing
 * blocks carry a block id and a `source-` class and no kind, and the gloss face pairs words in
 * `gloss-german` spans. Leaving the third out made the gloss faces report zero German elements,
 * which is a scan that cannot fail: it looked clean on all four and would have stayed clean if
 * every `lang` on the face were deleted.
 */
export function germanTextTags(html: string): string[] {
  const kinded = tagsWithAttribute(html, "data-kind").filter(
    (tag) => !/\sdata-kind="equation"/.test(tag),
  );
  const unkinded = tagsWithAttribute(html, "data-block-id").filter(
    (tag) =>
      !/\sdata-kind="/.test(tag) &&
      !/\sdata-align-sentences-control="/.test(tag) &&
      /class="source-/.test(tag),
  );
  const glossed = html.match(/<[a-zA-Z][^>]*\sclass="[^"]*gloss-german[^"]*"[^>]*>/g) ?? [];
  return [...kinded, ...unkinded, ...glossed];
}

// ---------------------------------------------------------------- 4. anchors

/**
 * Whether an in-scope anchor resolves on this page.
 *
 * A German unit split into several English units keeps the source id with a letter suffix
 * (`s1-fn3` becomes `s1-fn3a` … `s1-fn3d`), and the English face publishes the children. So the
 * base id resolves when a split child of it does; `parseSplitTranslationUnitId` owns that grammar
 * and is asked rather than copied. Without this rule, light quanta's English face reported two
 * missing footnote anchors that are both correctly published under their split ids.
 */
export function anchorResolves(id: string, ids: ReadonlySet<string>): boolean {
  if (ids.has(id)) return true;
  for (const declared of ids) {
    const split = parseSplitTranslationUnitId(declared);
    if (split !== null && split.base === id) return true;
  }
  return false;
}

export function scanAnchors(
  html: string,
  expected: readonly string[],
): { findings: StaticHtmlFinding[]; resolved: number } {
  const ids = declaredIds(html);
  const findings: StaticHtmlFinding[] = [];
  let resolved = 0;
  const missing: string[] = [];
  for (const id of expected) {
    if (anchorResolves(id, ids)) {
      resolved += 1;
      continue;
    }
    missing.push(id);
  }
  if (missing.length > 0) {
    findings.push({
      code: "static-html-anchor-missing",
      message:
        `${missing.length} of ${expected.length} in-scope anchors do not resolve on this face, ` +
        "so a deep link to them lands nowhere.",
      sample: missing.slice(0, 12).join(", "),
    });
  }
  return { findings, resolved };
}

// ---------------------------------------------------------------- 5. the retired banners

/**
 * The review notices D-2026-09-25-no-review-status-banners removed, kept as explicit negatives.
 *
 * The owner's words were "we don't need messages like this on the site", quoting the English
 * face's banner, and the decision reads that as the whole category. Each string below is one the
 * decision names. Component render tests already assert two of them are gone; this is the same
 * assertion one layer out, over the bytes a reader is served, which is the layer no-JavaScript
 * readers get and the only one a build can be wrong about on its own.
 */
const RETIRED_REVIEW_BANNERS: readonly string[] = Object.freeze([
  "Machine draft, not reviewed",
  "Translated and checked by AI agents",
  "Machine-drafted gloss, not yet reviewed",
  "No person has reviewed it",
]);

export function scanRetiredReviewBanners(visible: string): StaticHtmlFinding[] {
  const findings: StaticHtmlFinding[] = [];
  for (const banner of RETIRED_REVIEW_BANNERS) {
    const at = visible.indexOf(banner);
    if (at === -1) continue;
    findings.push({
      code: "static-html-retired-review-banner",
      message:
        `The reading face carries "${banner}", a review notice the owner removed ` +
        "(D-2026-09-25-no-review-status-banners).",
      sample: clip(visible, at),
    });
  }
  return findings;
}

// ---------------------------------------------------------------- all five

export type StaticHtmlScanInput = Readonly<{
  html: string;
  face: ScannedFace;
  /**
   * The anchors this face is responsible for publishing. Empty means the caller has none to
   * assert, and the census then says `anchorsExpected: 0` so the pass cannot be read as proof.
   */
  expectedAnchors?: readonly string[] | undefined;
}>;

export function scanFaceHtml(input: StaticHtmlScanInput): StaticHtmlScanResult {
  const visible = readerVisibleText(input.html);
  const expected = input.expectedAnchors ?? [];
  const anchors = scanAnchors(input.html, expected);
  const german = germanTextTags(input.html);
  const findings = [
    ...scanLedgerFurniture(visible),
    ...scanRawLatex(visible),
    ...scanContentLanguage(input.html, input.face),
    ...anchors.findings,
    ...scanRetiredReviewBanners(visible),
  ];
  const notes: string[] = [];
  if (expected.length === 0) {
    notes.push("No anchors were asserted on this face, so the anchor scan proves nothing here.");
  }
  if (german.length === 0 && SHOWS_GERMAN.has(input.face)) {
    notes.push(
      `The ${input.face} face shows German and this scan found no German text element, so the ` +
        "language scan proves nothing here. That is a defect in the scan's population, not a pass.",
    );
  }
  return {
    findings: Object.freeze(findings),
    examined: {
      bytes: input.html.length,
      readerVisibleBytes: visible.length,
      declaredIds: declaredIds(input.html).size,
      anchorsExpected: expected.length,
      anchorsResolved: anchors.resolved,
      germanTextElements: german.length,
    },
    notes: Object.freeze(notes),
  };
}
