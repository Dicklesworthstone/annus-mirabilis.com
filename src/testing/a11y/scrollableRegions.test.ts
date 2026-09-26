import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * A ratchet for keyboard-reachable scrollable regions (WCAG 2.1.1, axe scrollable-region-focusable, am-bc6s).
 *
 * A CSS region that scrolls (overflow / overflow-x / overflow-y: auto | scroll)
 * must be reachable by keyboard (tabIndex={0} with an accessible name like aria-label),
 * unless it is proven not to overflow on any supported viewport (320px..1280px)
 * or is a dialog/sheet container that already contains focusable interactive children.
 *
 * Bulk-applying tabIndex={0} to non-overflowing elements creates useless tab stops
 * and degrades the keyboard navigation experience.
 *
 * This test acts as a ratchet:
 * 1. Pre-existing lab components with unverified table-scroll/formula elements are pinned in BASELINE.
 *    The baseline may only SHRINK; introducing an unfocusable scrollable element in a new file fails.
 * 2. ELEMENTS verified empirically NOT to overflow are recorded in RECORDED_NON_OVERFLOWING with
 *    measurements, and the detector CONSULTS that map (am-uj6w). Until then the map was named in
 *    the failure message and read by nothing, so a contributor who measured a region and followed
 *    the instruction saw no change - the gate prescribed a remedy it did not read.
 *
 *    Keyed by FILE AND CLASS, not by class. "table-scroll" covers both overflowing and
 *    non-overflowing elements, so a class-level exemption would excuse every use of it at once.
 *
 *    The measurements are PARSED AND CHECKED, not merely stored: an entry whose own numbers show
 *    a difference between scrollWidth and clientWidth is refused, and so is one naming a file
 *    that no longer carries that class. Those are the two ways a recorded measurement goes stale.
 * 3. Dialog/sheet containers managing modal focus are recorded in DIALOG_CONTAINER_SELECTORS.
 */

const ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));

/**
 * Dialogs, sheets, and popovers that manage modal focus or contain focusable children.
 * These are excluded from requiring tabIndex on the outer container itself.
 */
export const DIALOG_CONTAINER_SELECTORS = new Set([
  "clarification-dialog",
  "notebook-dialog",
  "search-dialog",
  "search-results",
  "reader-bottom-sheet",
  "reader-sticky-lab",
  "countermodel-scroll",
]);

/**
 * Classes with CSS overflow: auto/scroll that have been empirically verified
 * NOT to overflow at 320px or 1280px viewports, and therefore must NOT carry
 * tabIndex={0} (to avoid phantom tab stops for keyboard readers).
 *
 * Each entry records:
 * - component/file
 * - measured page URL
 * - viewport measurements (scrollWidth vs clientWidth)
 * - rationale
 */
export interface NonOverflowingRecord {
  readonly file: string;
  readonly className: string;
  /**
   * The element's accessible name, when its file holds more than one element
   * of the same class (am-bc6s).
   *
   * file-plus-class cannot separate two elements of one class, and
   * RodSimultaneityLab.tsx holds exactly that: one `table-scroll` that
   * overflows at 320px (325/216) and one that fits (216/216). Without a third
   * component the key forces a false choice between recording a measurement
   * nobody took for the overflowing one and leaving the fitting one focused.
   * The accessible name is the discriminator because it is semantic, unique
   * here, already required on these elements, and unlike a line number it
   * survives an edit above it.
   */
  readonly ariaLabel?: string | undefined;
  readonly url: string;
  /** "320px: 254px/254px (diff 0); 1280px: 1150px/1150px (diff 0)" - parsed, not just stored. */
  readonly measurements: string;
  readonly reason: string;
  readonly measuredBy: string;
}

/**
 * The key a record is looked up by: one ELEMENT, not one class.
 *
 * The comment above said that before the key could do it. Omitting the
 * accessible name keeps the existing single-element records keyed exactly as
 * they were; supplying it separates two elements of one class in one file.
 */
export function recordKey(file: string, className: string, ariaLabel?: string): string {
  return ariaLabel === undefined ? `${file}::${className}` : `${file}::${className}::${ariaLabel}`;
}

export const RECORDED_NON_OVERFLOWING: ReadonlyMap<string, NonOverflowingRecord> = new Map(
  (
    [
      {
        file: "src/components/lab/lq08/PhotoelectricLab.tsx",
        className: "table-scroll",
        url: "/lab/lq-08/",
        measurements: "320px: 220px/220px (diff 0); 1280px: 1116px/1116px (diff 0)",
        reason:
          "Was 636px/220px, then 253px/220px once the dotted identifier columns could wrap, then fitting once its ten cells read --table-cell-x instead of an inline 0.5rem no stylesheet could reach. This file carries exactly one element of this class.",
        measuredBy: "am-6iz4",
      },
      {
        file: "src/components/lab/sr12/ChargeCurrentLab.tsx",
        className: "table-scroll",
        url: "/lab/sr-12/",
        measurements: "320px: 252px/252px (diff 0); 1280px: 1148px/1148px (diff 0)",
        reason:
          "Was 400px/252px, then 274px/252px once the identifier columns could wrap, then fitting once its forty-eight cells read --table-cell-x instead of an inline 0.5rem shorthand. The 1280px figure is unchanged, which is the evidence the desktop rendering did not move. This file carries exactly one element of this class.",
        measuredBy: "am-6iz4",
      },
      {
        file: "src/components/lab/WaveDescriptionLab.tsx",
        className: "table-scroll",
        url: "/lab/lq-01/",
        measurements: "320px: 220px/220px (diff 0); 1280px: 1116px/1116px (diff 0)",
        reason:
          "Was 604px/220px. Two causes, both measured: the dotted Quantity ID and Owner ID columns had no break opportunity and held 400 of the 604 pixels, and the ten cells set their padding inline so the site's own narrow-viewport rule never reached them. The identifier columns may now wrap below 480px and the cells read --table-cell-x. This file carries exactly one element of this class.",
        measuredBy: "am-6iz4",
      },
      {
        file: "src/components/lab/lq05/IndependentConfigurationsLab.tsx",
        className: "table-scroll",
        url: "/lab/lq-05/",
        measurements: "320px: 190px/190px (diff 0); 1280px: 926px/926px (diff 0)",
        reason:
          "Was 254px/190px. Its twenty cells set padding inline, which no stylesheet rule can reach, so twelve pixels a side across four columns spent ninety-six of a one-hundred-and-ninety-pixel box. They now read the horizontal half from --table-cell-x, unchanged at 0.75rem on a desktop and 0.25rem below 480px, so the 1280px measurement is identical to before. This file carries exactly one element of this class.",
        measuredBy: "am-6iz4",
      },
      {
        file: "src/components/lab/lq06/CoefficientMatchLab.tsx",
        className: "table-scroll",
        url: "/lab/lq-06/",
        measurements: "320px: 286px/286px (diff 0); 1280px: 529px/529px (diff 0)",
        reason:
          "Measured against the built site after d9bc02aa let the dotted identifier columns wrap below 480px. This file carries exactly one element of this class, so the record covers precisely what was measured. The table was also driven to every control extreme before the wrap landed and its width did not move, so it is not input-dependent.",
        measuredBy: "am-6iz4",
      },
      {
        file: "src/components/lab/lq07/FluorescenceLab.tsx",
        className: "table-scroll",
        url: "/lab/lq-07/",
        measurements: "320px: 190px/190px (diff 0); 1280px: 926px/926px (diff 0)",
        reason:
          "Measured against the built site after d9bc02aa let the dotted identifier columns wrap below 480px; it was 303px/190px before. This file carries exactly one element of this class, so the record covers precisely what was measured.",
        measuredBy: "am-6iz4",
      },
      {
        file: "src/reader/entrances/BrownianFirstEncounter.tsx",
        className: "formula",
        url: "/papers/brownian-motion/",
        measurements: "320px: 288px/288px (diff 0); 1280px: 680px/680px (diff 0)",
        reason:
          "Both `formula` elements in this file render ONLY with JavaScript disabled: with JS the component swaps that branch for a card layout, so a hydrated measurement finds nothing. Measured in a javaScriptEnabled:false context, which is the only state in which a reader sees them, on /papers/brownian-motion/ and its /s4/ section. Their content is the server-default four-entry signed sum, so it does not grow with reader input. The file carries exactly two elements of this class and both were measured.",
        measuredBy: "am-6iz4",
      },
      {
        file: "src/reader/entrances/BrownianFirstEncounter.tsx",
        className: "table-scroll",
        url: "/papers/brownian-motion/",
        measurements: "320px: 288px/288px (diff 0); 1280px: 640px/640px (diff 0)",
        reason:
          'Reached only through the "Table and typed values" tab of the step-1 interaction mode; the default tab renders the visual number line and this element is absent, so a measurement of the page as loaded finds nothing. Measured after clicking that tab, which is the only state in which a reader sees it. The table has four fixed columns of short signed numbers and does not grow with reader input. The file carries exactly one element of this class.',
        measuredBy: "am-bc6s",
      },
      {
        file: "src/components/lab/RodSimultaneityLab.tsx",
        className: "table-scroll",
        ariaLabel: "Values at these settings",
        url: "/lab/sr-03/",
        measurements: "320px: 254px/254px (diff 0); 1280px: 704px/704px (diff 0)",
        reason:
          "This file holds TWO elements of class table-scroll and they differ: the spacetime-coordinates table overflows at 320px (322/217) and keeps its tabIndex, and this values table fits. Distinguished by accessible name because file-plus-class cannot tell them apart. Renamed from 'Accepted laboratory telemetry snapshot table' when the table became two columns, quantity name and value (c043794f); re-measured then, with the lab rendered from source into BUILD 14.",
        measuredBy: "BoldCanyon",
      },
      {
        file: "src/components/lab/TracerLab.tsx",
        className: "lab-bottom",
        url: "/lab/bm-01/",
        measurements: "320px: 254px/254px (diff 0); 1280px: 1150px/1150px (diff 0)",
        reason:
          "CSS in globals.css sets display: grid with responsive columns; does not set overflow in CSS.",
        measuredBy: "am-bc6s",
      },
      {
        file: "src/components/lab/TrajectoryInspection.tsx",
        className: "table-scroll",
        url: "/lab/brownian-data/",
        measurements: "320px: 254px/254px (diff 0); 1280px: 1150px/1150px (diff 0)",
        reason:
          "Table columns format short coordinates; with 320px font sizing and padding, table fits inside 254px container.",
        measuredBy: "am-bc6s",
      },
      {
        file: "src/components/lab/sr07/FieldEquationsLab.tsx",
        className: "sr07-components",
        url: "/lab/sr-07/",
        measurements: "320px: 288px/288px (diff 0); 1280px: 1216px/1216px (diff 0)",
        reason:
          "Applied to a <table> element with default display: table; fits viewport width without scrolling.",
        measuredBy: "am-bc6s",
      },
      {
        file: "src/components/lab/sr07/FieldEquationsLab.tsx",
        className: "sr07-equation",
        url: "/lab/sr-07/",
        measurements: "320px: 288px/288px (diff 0); 1280px: 1216px/1216px (diff 0)",
        reason:
          "Equations and steps fit within the mobile measure; checked across all 8 equations and both unit layers.",
        measuredBy: "am-bc6s",
      },
      {
        file: "src/equations/genealogy/Genealogy.tsx",
        className: "genealogy-graph-wrapper",
        url: "Genealogy component",
        measurements: "320px: 236px/236px (diff 0); 1280px: 1196px/1196px (diff 0)",
        reason:
          "Child SVG has width='100%' and max-width: 100% in genealogy.css; scales to fit container width without scrolling.",
        measuredBy: "am-bc6s",
      },
      {
        file: "src/reader/faces/FacsimileViewer.tsx",
        className: "facsimile-canvas-container",
        url: "/papers/brownian-motion/view/facsimile/",
        measurements: "320px: 206px/206px (diff 0); 1280px: 1166px/1166px (diff 0)",
        reason:
          ".facsimile-page-frame has max-width: 100% in reader.css; canvas preview conforms to container width.",
        measuredBy: "am-bc6s",
      },
      {
        file: "src/components/lab/lq09/IonizationLab.tsx",
        className: "table-scroll",
        url: "/lab/lq-09/",
        measurements: "320px: 286px/286px (diff 0); 1280px: 529px/529px (diff 0)",
        reason:
          "Telemetry snapshot table formats short numeric cells and fits the container at both widths, so its tabIndex is a tab stop with nothing to scroll.",
        measuredBy: "pane28, measured against the built site under am-6iz4",
      },
      {
        file: "src/equations/missingStep/MissingStepPanel.tsx",
        className: "missing-step-math",
        url: "/papers/brownian-motion/",
        measurements: "320px: 254px/254px (diff 0); 1280px: 308px/308px (diff 0)",
        reason:
          "One JSX element rendering the Before and After of each missing step: 16 instances, 8 on /papers/brownian-motion/ and 8 on its /s4/ section, all measured on live 095fe596 with every <details> opened, and the widest is given. It was 4 of 16 overflowing (317px/254px) before the derivation steps were given row layouts. The content is build-time KaTeX and does not grow with reader input; if one ever overflows, formulaOverflow.inline.ts gives it a named tab stop at runtime.",
        measuredBy: "GreenBarn under am-14at, 2026-09-24",
      },
    ] satisfies readonly NonOverflowingRecord[]
  ).map((r) => [recordKey(r.file, r.className, r.ariaLabel), r]),
);

/** One recorded viewport measurement, after parsing. */
export interface ParsedMeasurement {
  readonly viewport: string;
  readonly scrollWidth: number;
  readonly clientWidth: number;
}

/**
 * Parses "320px: 254px/254px (diff 0); 1280px: ..." into numbers the gate can check.
 * Returns an empty array when nothing parses, which the validation test treats as a failure:
 * an unparseable measurement is indistinguishable from no measurement.
 */
export function parseMeasurements(text: string): ParsedMeasurement[] {
  const out: ParsedMeasurement[] = [];
  for (const m of text.matchAll(/(\d+px)\s*:\s*(\d+)px\s*\/\s*(\d+)px/g)) {
    out.push({
      viewport: m[1] as string,
      scrollWidth: Number(m[2]),
      clientWidth: Number(m[3]),
    });
  }
  return out;
}

/**
 * Every JSX opening tag that carries a className, with its attribute text and
 * its class list split out.
 *
 * One walker, used by the counter and by the staleness check, so the two agree
 * about what an element is. Its limits are the limits of a regex over JSX: a
 * tag whose attributes contain a `>` (an inline arrow function, a comparison)
 * is not seen. That is why the staleness check below fails CLOSED - an element
 * this cannot find is reported as missing rather than assumed present.
 */
/**
 * A CSS-module reference names a class as surely as a string literal does.
 *
 * am-bc6s. The walker read only the string forms, so `className={styles.tableWrap}` yielded
 * no element at all: `accessibleNamesForClass(src, "tableWrap")` returned [] and
 * `countUnreachableScrollRegions` returned 0 for a file whose scroll region has no tab stop.
 * Meanwhile deriveScrollClassesFromCss reads `.tableWrap { overflow-x: auto }` straight out of
 * the module stylesheet, so the coverage half of this gate saw the class and the element half
 * could not. Listing such a class in AUDITED_SCROLL_CLASSES would have been a vacuous audit -
 * the counter cannot reach the element, so it reports 0 whatever the markup says.
 *
 * Only a brace expression that actually mentions `styles` is read, so an arbitrary call
 * (`className={cx(a, b)}`) still yields nothing rather than contributing `cx` as a class name.
 */
const CSS_MODULE_CLASS_REFERENCE =
  /\bstyles\s*(?:\.\s*([A-Za-z_$][\w$]*)|\[\s*["']([^"']+)["']\s*\])/g;

export function classTokens(raw: string): string[] {
  const normalised = raw.replace(
    CSS_MODULE_CLASS_REFERENCE,
    (_match, dotted?: string, bracketed?: string) => ` ${dotted ?? bracketed ?? ""} `,
  );
  return normalised
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => /^[A-Za-z_-][\w-]*$/.test(token));
}

/**
 * Blanks JSX comments inside an opening tag, keeping the text length so nothing else shifts.
 *
 * THE GATE READ ITS OWN DOCUMENTATION AS COMPLIANCE. `countUnreachableScrollRegions` asks
 * /tabIndex|tabindex/i of the whole attribute text, and the biome-ignore that every repair in this
 * repository carries names the rule it suppresses:
 *
 *     // biome-ignore lint/a11y/noNoninteractiveTabindex: a region that scrolls must be focusable
 *
 * "noNoninteractiveTabindex" CONTAINS "Tabindex". So an element whose tab stop was deleted still
 * matched, and the ratchet reported it reachable. Isolated by plant on LogarithmProductTable:
 *
 *     tabIndex removed, comment left        18 pass 0 fail   <- the gate fails open
 *     tabIndex and comment both removed     1 regression, named, correct message
 *
 * The comment was the only difference. This is the failure AGENTS.md describes under "a gate that
 * forbids a construct must read code, not text", running in the opposite direction: a gate that
 * REQUIRES a construct was satisfied by prose about it. It is self-concealing in the worst way,
 * because the prose in question is the explanation of why the tab stop is needed - so the better
 * the comment, the more certainly the gate stopped checking.
 *
 * Only line comments at the start of a line are blanked, so a `//` inside a quoted attribute value
 * (`href="https://..."`) cannot swallow the rest of the tag.
 */
function blankTagComments(attrs: string): string {
  return attrs
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, (m) => " ".repeat(m.length))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length))
    .replace(
      /^([ \t]*)\/\/[^\n]*/gm,
      (m, indent: string) => indent + " ".repeat(m.length - indent.length),
    );
}

function* elementsWithClasses(source: string): Generator<{ attrs: string; classes: string[] }> {
  for (const match of source.matchAll(/<([a-zA-Z0-9_-]+)\b([^>]*?)>/gs)) {
    const attrs = blankTagComments(match[2] ?? "");
    const classAttrMatch = attrs.match(
      /className\s*=\s*(?:\{`([^`]+)`\}|"([^"]+)"|'([^']+)'|\{([^{}]*\bstyles\s*[.[][^{}]*)\})/s,
    );
    if (!classAttrMatch) continue;
    const classStr =
      classAttrMatch[1] ?? classAttrMatch[2] ?? classAttrMatch[3] ?? classAttrMatch[4] ?? "";
    yield { attrs, classes: classTokens(classStr) };
  }
}

/**
 * The accessible names carried by the elements of `className` in one source file.
 *
 * The staleness check needs a structural relation - this element carries that
 * name - and asking whether the FILE contains the string is not one. am-afam
 * demonstrated the gap by plant: repointing the RodSimultaneityLab record at
 * "Predict before calculating", the real aria-label of a button at :220 that is
 * neither a table-scroll nor a scroll region, left the suite at 11 pass 0 fail.
 * A name that belongs to some other element of some other kind makes the record
 * point at nothing that was measured, which is exactly what the name was added
 * to prevent.
 */
export function accessibleNamesForClass(source: string, className: string): string[] {
  const names: string[] = [];
  for (const { attrs, classes } of elementsWithClasses(source)) {
    if (!classes.includes(className)) continue;
    const labelMatch = attrs.match(
      /aria-label\s*=\s*(?:\{`([^`]*)`\}|\{"([^"]*)"\}|"([^"]*)"|'([^']*)')/s,
    );
    const label = labelMatch?.[1] ?? labelMatch?.[2] ?? labelMatch?.[3] ?? labelMatch?.[4];
    if (label !== undefined) names.push(label);
  }
  return names;
}

/** A record is honoured only while its own numbers still say the region does not overflow. */
export function staleReason(
  record: NonOverflowingRecord,
  sourceOfFile: (file: string) => string | undefined,
): string | undefined {
  const parsed = parseMeasurements(record.measurements);
  if (parsed.length === 0) {
    return `${recordKey(record.file, record.className)}: measurements do not parse: "${record.measurements}"`;
  }
  // A region that was never laid out measures 0/0, which shows no overflow and would be honoured
  // as proof that it fits. It is not proof of anything: it is proof the element was not rendered
  // when someone measured it.
  //
  // This is not hypothetical. Measured on 2026-09-22: construction-table-wrap has 74 rendered
  // instances across 29 built pages, and SEVENTY of them report 0/0 at 320px because they sit
  // inside a collapsed `section` on the papers routes. Anyone auditing that class by opening each
  // page and measuring would have produced seventy passing exemptions from seventy elements that
  // never appeared. Only 3 of the 74 actually overflow and 1 genuinely fits.
  //
  // The rule is zero specifically, not a small-width threshold: zero means not laid out, and any
  // other cutoff would be a number nobody measured.
  const notLaidOut = parsed.filter((p) => p.clientWidth === 0 || p.scrollWidth === 0);
  if (notLaidOut.length > 0) {
    const at = notLaidOut.map((p) => `${p.viewport} ${p.scrollWidth}/${p.clientWidth}`).join(", ");
    return `${recordKey(record.file, record.className)}: the recorded measurements are zero-width at ${at}, so the element was not laid out when it was measured. That is not evidence the region fits; re-measure it with the region actually rendered.`;
  }
  const overflowing = parsed.filter((p) => p.scrollWidth > p.clientWidth);
  if (overflowing.length > 0) {
    const at = overflowing.map((p) => `${p.viewport} ${p.scrollWidth}/${p.clientWidth}`).join(", ");
    return `${recordKey(record.file, record.className)}: the recorded measurements themselves show overflow at ${at}. A region that overflows must keep its tabIndex.`;
  }
  const src = sourceOfFile(record.file);
  if (src === undefined) {
    return `${recordKey(record.file, record.className)}: the file no longer exists, so the measurement describes nothing.`;
  }
  if (!src.includes(record.className)) {
    return `${recordKey(record.file, record.className)}: the file no longer carries that class, so the measurement is stale.`;
  }
  if (record.ariaLabel !== undefined) {
    const names = accessibleNamesForClass(src, record.className);
    if (!names.includes(record.ariaLabel)) {
      const found =
        names.length > 0
          ? `elements of that class carry: ${names.map((n) => `"${n}"`).join(", ")}`
          : "no element of that class in that file carries an accessible name this can read";
      return `${recordKey(record.file, record.className, record.ariaLabel)}: no element with className "${record.className}" carries the accessible name "${record.ariaLabel}" (${found}). The name is the discriminator between two recorded elements of one class, so a name that belongs to a different element - or to nothing - makes the record point at something nobody measured.`;
    }
  }
  return undefined;
}

/**
 * Classes that specify scrolling in CSS and must be focusable when rendered.
 */
export const AUDITED_SCROLL_CLASSES = [
  // sr-event-table: overflow-x: auto on a section that wraps a wide event table. Measured on the
  // 11:59:54 build - 4 elements carry it and 0 lack a tabIndex - and RelativityEventTable.tsx
  // gives each one tabIndex={0} plus aria-label={example.title}, with a :focus-visible outline in
  // investigation.css. Focusable, named, and visibly focused, which is what audited means here.
  "sr-event-table",
  // shelf-table-scroll: overflow-x: auto on the div around each shelf-optics comparison table.
  // Measured on BUILD 6 (15:37:12): 3 elements on 3 pages, 0 lack tabindex="0", 0 lack an
  // aria-label. ShelfOpticsLab.tsx gives it role="region", aria-label="Computed model
  // comparison, scroll horizontally if needed" and tabIndex={0}, and shelfOptics.css gives it a
  // :focus-visible outline. It arrived with the origin shelf-optics commits already compliant;
  // it was red only because nobody had recorded it.
  "shelf-table-scroll",
  "table-scroll",
  "kitchen-schema",
  "step-math",
  "reader-local-overflow",
  "pagemap-table-container",
  "formula",
  "equation-formula",
  "show-the-code-scroll",
  "kernel-trace-wrap",
  "comparison-scroll",
  // am-bc6s. Its element already carries tabIndex={0}, role="region" and an aria-label -
  // LightQuantaInvestigation.tsx:585-589 - so this is a listing of markup that was already
  // correct, not a repair. Verified non-vacuous the same way as tableWrap: removing the tab
  // stop takes countUnreachableScrollRegions from 0 to 1 for that file.
  "light-table-scroll",
  // am-bc6s. The first CSS-module class to reach this list. It is a real audit and not a
  // listing: classTokens above now reads `className={styles.tableWrap}`, so the counter
  // reaches the element. Verified by watching this entry take the counter from 0 to 1 while
  // the wrapper still had no tab stop, before the tab stop was added.
  "tableWrap",
  // am-uj6w, fd50a3fd. All six components that use it now wrap their table in a <section> with
  // tabIndex={0} and an aria-label: HeldFixedToggle (817d2cc1), TaylorBinomialExtension (am-a3f1),
  // and the four repaired in fd50a3fd - LogarithmProductTable, RepeatedProportionalTable,
  // NudgeSensitivityDemo, TableToPlotBuilder. Measured at 320px beforehand: logarithms +202px,
  // exponentials +64px, derivatives +23px; functions-graphs fits and was repaired anyway, since a
  // declared-scrolling container scrolls on its data and type size, not on the viewport alone.
  //
  // Verified non-vacuous the way the two entries above were: removing the tab stop from
  // LogarithmProductTable takes countUnreachableScrollRegions from 0 to 1 for that file. That
  // check matters more here than usual, because these six tags are MULTI-LINE - the attribute sits
  // three lines below the tag name - and a parser that only read the first line would have counted
  // six repaired elements as zero and called it audited.
  "construction-table-wrap",
  // reader-companion-column: overflow: auto from 3485cc37, so the sticky companion beside the text
  // scrolls inside itself when it is taller than the window (a 1280x800 laptop, where a section's
  // plate and symbol key measure 820px in a 702px column on BUILD 20). ReaderLayout.tsx gives the
  // aside tabIndex={0}; it is already named by aria-label={companionTitle}. The focus ring is the
  // global :focus-visible outline.
  "reader-companion-column",
  // reading-formula-row: overflow-x: auto on the row of a ColouredFormula, so a relation wider than
  // a phone scrolls inside its line. ColouredFormula.tsx makes the row a <section> with
  // tabIndex={0} and aria-label "Formula: <the equations' titles>", the pattern of the facsimile
  // page map and the kitchen tables.
  "reading-formula-row",
  // occupancy-table-scroll: overflow-x: auto on the two table wrappers of the independence
  // countermodel (/lab/countermodels/independence/), which arrived from origin with the markup
  // already right and no entry here. IndependenceWorkbench.tsx gives both role="region",
  // tabIndex={0} and a name ("Model prediction table", "Count probability distributions"); the
  // focus ring is the global :focus-visible outline, which independence.css does not override.
  "occupancy-table-scroll",
  // photo-data-table: overflow-x: auto on the observations table of the lq-08 data workbench
  // (/lab/lq-08/data/). PhotoelectricDataWorkbench.tsx gives it role="region", tabIndex={0} and
  // aria-label "Accepted observations, residuals and row selection"; the focus ring is the global
  // :focus-visible outline.
  "photo-data-table",
  // missing-step-math: overflow-x: auto on the Before and After of each Brownian missing step.
  // Promoted from NOT_YET_AUDITED under am-14at: all 16 instances fit at 320px and 1280px, so the
  // element needs no tabIndex, and without one it is exempt only through its
  // RECORDED_NON_OVERFLOWING entry.
  // Listing it here is what makes that entry load-bearing: removed, the element counts as
  // unreachable, where before this class was not counted at all.
  "missing-step-math",
];

/**
 * am-a14x. AUDITED_SCROLL_CLASSES above is hand-listed. The CSS declares 47 classes with a
 * scrolling overflow, so the ratchet's denominator was a fifth of its subject and nothing said so:
 * a new scrollable region could be added, never be looked at, and the suite stayed green.
 *
 * deriveScrollClassesFromCss reads the real population out of src/**\/*.css. The test below asserts
 * that every derived class is either AUDITED or recorded here, so a class in NEITHER list fails on
 * arrival. That is the coverage question. It is deliberately NOT an escape: nothing here exempts an
 * element from needing a tab stop, which is am-uj6w's mechanism and pane30's to own.
 *
 * The number beside each class is the count of elements carrying it with no tabIndex TODAY. It is
 * the size of the shortfall, recorded so the gap is stated rather than discovered. An entry that
 * reaches 0 is reported as stale, because a clean class belongs in AUDITED_SCROLL_CLASSES.
 */
export const NOT_YET_AUDITED = new Map<string, number>([
  ["camera-results", 4],
  ["clarification-dialog", 2],
  ["controlled-comparison", 1],
  ["countermodel-scroll", 0],
  ["data-panel-table-wrap", 2],
  ["encounter-table", 2],
  ["equation-body", 2],
  ["facsimile-canvas-container", 1],
  ["facsimile-stage", 1],
  ["genealogy-graph-wrapper", 1],
  // A display printed inside its German sentence (inlines.tsx), made a block that scrolls in its
  // own line so a formula wider than a phone column no longer widens the page (dispatch 149: 61px
  // at 390 on live d5ff5c76's parallel face). One JSX element, with no tabIndex in the TSX: like
  // linear-formula-scroll, its tab stop is added at runtime by formulaOverflow.inline.ts, and only
  // when it overflows.
  ["inline-display", 1],
  // A formula inside a line of text (inlines.tsx, GlossPair.tsx, NotationEntryCard.tsx), made an
  // inline-flex box that scrolls in its line by 300f81ec, so Brownian's s2-p4-s1 formula (309 to
  // 345px) no longer widens the English, parallel and gloss faces at 320. Three JSX elements, with
  // no tabIndex in the TSX: like inline-display, the tab stop and name come at runtime from
  // formulaOverflow.inline.ts, only when the formula overflows. Measured on live Brownian at 320
  // with 300f81ec's rule injected (Chromium and WebKit alike): 8 of 536 formulas scroll across the
  // three faces, 8 of 8 get tabindex="0" and a name, and 0 that fit get a tab stop.
  ["inline-math", 3],
  ["inference-workbench", 0],
  ["kitchen-guide", 1],
  ["kitchen-lab", 1],
  ["latex-block-wrapper", 1],
  // The rule used to be `.linear-formula > [aria-hidden]`, crediting the ancestor; the element that
  // scrolls is now a named wrapper, so the entry names it (2026-09-24). Its tab stop is added at
  // runtime by formulaOverflow.inline.ts, only when it overflows, hence no tabIndex in the TSX.
  ["linear-formula-scroll", 2],
  ["low-speed-table", 1],
  ["mass-energy-investigation", 1],
  ["me-table", 0],
  ["missing-step-table", 1],
  ["notebook-dialog", 0],
  ["notebook-replay", 0],
  ["reader-bottom-sheet", 1],
  ["replay-table", 0],
  ["scale-facts-table-wrap", 1],
  ["search-dialog", 0],
  ["search-results", 0],
  // The German of a sentence the gloss face has no gloss unit for (GlossSentence.tsx), printed
  // with its formulas as KaTeX since f7ab060c. An inline formula cannot wrap, so the sentence
  // scrolls in its own box rather than widening the page (glossReasoning.css; 5px at 390 on
  // Brownian's s2-p4-s1 and s2-p4-s4). One JSX element, with no tabIndex in the TSX: like
  // inline-display, its tab stop is added at runtime by formulaOverflow.inline.ts, only when it
  // overflows (3 of Brownian's 87 unglossed sentences at 390, 15 at 320), so one that fits
  // carries none.
  ["sentence-german-unadorned", 1],
  ["show-the-code", 4],
  /*
    sr-investigation-page is an ANCESTOR, not a scrolling element. It reaches this list because
    deriveScrollClassesFromCss takes every class in a selector, and the only rule that scrolls is
    `.sr-investigation-page .sr-event-table { overflow-x: auto }` - the subject is the table.

    It is recorded rather than excluded because that over-approximation is the safe direction for
    a coverage ratchet, and because it is not a special case: measured across src/**\/*.css, 10 of
    the 51 derived classes never appear as the subject of an overflow rule, and 9 of them were
    already in these lists (camera-results, controlled-comparison, inference-workbench,
    kitchen-guide, kitchen-lab, linear-formula, mass-energy-investigation, notebook-replay,
    show-the-code). This is the tenth, recorded the same way. (linear-formula has since left the
    list: on 2026-09-24 its rule moved to the element that scrolls, .linear-formula-scroll.)

    The 1 is the count the list's own contract asks for - elements carrying the class with no
    tabIndex - and it is honest rather than a debt anyone should pay: a page wrapper that does
    not scroll must NOT acquire a tab stop, which is exactly what the docblock above warns
    against. If this entry is ever "cleared", check that the class became a subject first.
  */
  ["sr-investigation-page", 1],
  ["source-equation", 1],
  ["sr07-components", 1],
  ["sr07-equation", 1],
  ["table-scroll-container", 1],
  ["table-wrapper", 2],
  ["trajectory-table-scroll", 1],
  ["video-observation-scroll", 1],
]);

/**
 * CSS with comment bodies blanked, so a class NAMED IN PROSE is not read as a selector.
 *
 * The rule matcher below takes everything between the previous `}` and the next `{` as the
 * selector. A block comment sitting above a rule therefore lands inside that span, and every
 * `.class` mentioned in it is harvested as though it were part of the selector.
 *
 * Measured on 2026-09-22 rather than reasoned about. globals.css gained one rule,
 * `div:has(> table.data-table) { overflow-x: auto }`, under a comment explaining the mechanism
 * it repairs - a comment that names `.foundation-construction` and
 * `div.thermodynamics-held-fixed-comparison` while doing the arithmetic. The gate reported all
 * THREE classes as declaring a scrolling overflow. Deleting the comment and leaving the rule
 * byte-identical dropped it to one. Neither of the other two declares overflow anywhere.
 *
 * So two of the three were phantoms, and the direction is the one AGENTS.md records: the prose
 * densest in `.class` names near an overflow rule is the documentation ABOUT that rule, so the
 * better the comment, the more phantoms it produces. Recording those two as unaudited scrollable
 * regions would have been recording work that does not exist, and adding tabIndex to them would
 * have created two phantom tab stops - the exact harm the RECORDED_NON_OVERFLOWING map exists to
 * prevent.
 *
 * Bodies are blanked rather than deleted so byte offsets and line numbers are unchanged for any
 * caller that reports them.
 */
export function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "));
}

export function deriveScrollClassesFromCss(rootDir: string = ROOT): ReadonlySet<string> {
  const found = new Set<string>();
  const walk = (dir: string): void => {
    let entries: import("node:fs").Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".css")) {
        const css = stripCssComments(readFileSync(full, "utf8"));
        for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/gs)) {
          if (!/overflow(?:-x|-y)?\s*:\s*(?:auto|scroll)\b/.test(body ?? "")) continue;
          for (const [, cls] of (selector ?? "").matchAll(/\.([A-Za-z_][A-Za-z0-9_-]*)/g)) {
            if (cls) found.add(cls);
          }
        }
      }
    }
  };
  walk(join(rootDir, "src"));
  return found;
}

/**
 * am-unaudited-scroll-regions-r4jx. deriveScrollClassesFromCss credits every class in a scrolling
 * rule's selector, so a rule whose TARGET (the last compound selector, the element the declaration
 * lands on) carries no class of its own is either credited to an ancestor or not seen at all:
 *
 * - `div:has(> table.data-table) { overflow-x: auto }` (globals.css, 0b505d9a) made a scroll region
 *   of every data table's container, and its only class sits inside `:has()`, on a descendant;
 * - `.linear-formula > [aria-hidden] { overflow-x: auto }` recorded `linear-formula`, the parent,
 *   while the aria-hidden child scrolled, and the page's overflow script put four tab stops inside
 *   aria-hidden content on /papers/mass-energy/ (repaired in 2e1e7b13).
 *
 * This finds every such rule so each is placed on purpose in CLASSLESS_SCROLL_TARGETS. Text inside
 * parentheses is blanked before the target is read, because a class inside `:has()`, `:not()` or
 * `:is()` belongs to some other element.
 */
export function classlessScrollTargets(css: string): { line: number; selector: string }[] {
  const text = stripCssComments(css);
  const targets: { line: number; selector: string }[] = [];
  for (const rule of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const [, rawSelector = "", body = ""] = rule;
    if (!/overflow(?:-x|-y)?\s*:\s*(?:auto|scroll)\b/.test(body)) continue;
    const start = (rule.index ?? 0) + rawSelector.length - rawSelector.trimStart().length;
    const line = text.slice(0, start).split("\n").length;
    let depth = 0;
    const flat = [...rawSelector.trim()]
      .map((ch) => {
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
        else if (depth > 0) return " ";
        return ch;
      })
      .join("");
    const originals = rawSelector.trim();
    let offset = 0;
    for (const part of flat.split(",")) {
      const selector = originals.slice(offset, offset + part.length).trim();
      offset += part.length + 1;
      const target =
        part
          .trim()
          .split(/\s*[>+~]\s*|\s+/)
          .filter(Boolean)
          .at(-1) ?? "";
      if (!/\.[A-Za-z_]/.test(target)) targets.push({ line, selector });
    }
  }
  return targets;
}

/**
 * Every scrolling rule in src/**\/*.css whose target carries no class, with how a keyboard reaches
 * the element. A new one fails the test below until it is placed here, and an entry whose rule is
 * gone fails as stale.
 */
export const CLASSLESS_SCROLL_TARGETS: ReadonlyMap<string, string> = new Map([
  [
    "[data-instrument-clarification-dialog]",
    "a modal <dialog>: mountDirectOpen.ts opens it with showModal() and moves focus to its heading",
  ],
]);

/**
 * Baseline recorded post-fix for am-bc6s (2026-09-17).
 * The fixed files (kitchen/page.tsx, DerivationStepComponent.tsx, SplitTabs.tsx, FacsimileFace.tsx, edition/Formula.tsx)
 * are at 0 and omitted from this map.
 * May only shrink.
 */
export const BASELINE = new Map<string, number>([
  ["src/components/discover/BrownianInvestigation.tsx", 1],
  ["src/components/lab/bm03/ConfigurationLab.tsx", 1],
  ["src/components/lab/BrownianLab.tsx", 2],
  ["src/components/lab/CameraLab.tsx", 2],
  ["src/components/lab/CameraPlots.tsx", 1],
  ["src/components/lab/DistributionPlot.tsx", 1],
  ["src/components/lab/InferenceLab.tsx", 1],
  ["src/components/lab/InferencePlots.tsx", 1],
  ["src/components/lab/kitchen/KitchenControls.tsx", 1],
  ["src/components/lab/kitchen/KitchenResults.tsx", 1],
  ["src/components/lab/OsmoticPartitionLab.tsx", 1],
  ["src/components/lab/WalkLab.tsx", 2],
  ["src/components/lab/WalkPlots.tsx", 1],
]);

/**
 * Pure two-sided ratchet comparison. Extracted so both the live scan and the
 * planted-negative tests exercise the same code path: a pawl that is only
 * reachable through a filesystem scan cannot be proven to fire.
 */
export function classifyAgainstBaseline(
  rel: string,
  count: number,
  allowed: number,
): { regression?: string; slack?: string } {
  if (count > allowed) {
    return {
      regression:
        `${rel}: ${count} unreachable scroll region(s), baseline ${allowed}. ` +
        "Add tabIndex={0} and an accessible aria-label, or document in RECORDED_NON_OVERFLOWING with measurements.",
    };
  }
  if (count < allowed) {
    return { slack: `${rel}: ${count} < ${allowed}` };
  }
  return {};
}

function findFiles(dir: string, ext: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...findFiles(full, ext));
    } else if (entry.endsWith(ext) && !entry.includes(".test.")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Counts scrollable regions that no keyboard user can reach.
 *
 * `file` is what makes the escape work (am-uj6w): a record is keyed by file AND class, so the
 * measured element is exempt while every other use of the same class still counts. Called
 * without a file, nothing is exempt - which is the safe default, and what the older call sites
 * that pass only a source string get.
 */
export function countUnreachableScrollRegions(
  source: string,
  file?: string,
  recorded: ReadonlyMap<string, NonOverflowingRecord> = RECORDED_NON_OVERFLOWING,
): number {
  let count = 0;
  for (const { attrs, classes } of elementsWithClasses(source)) {
    for (const cls of AUDITED_SCROLL_CLASSES) {
      if (classes.includes(cls)) {
        const hasTabIndex = /tabIndex|tabindex/i.test(attrs);
        if (!hasTabIndex) {
          // The documented escape, now actually read.
          if (file !== undefined && recorded.has(recordKey(file, cls))) continue;
          count++;
        }
      }
    }
  }
  return count;
}

/**
 * Parses one recorded measurement string into its two viewport readings.
 *
 * The map's own documentation says the measurements are "PARSED AND CHECKED,
 * not merely stored", and the field comment repeats it. Until this function
 * existed nothing read the string: a recorded measurement could say
 * "320px: 288px/300px (diff 12)" and the suite stayed green, which I verified
 * by planting exactly that. A record nobody parses is not evidence, and the
 * whole point of this map is that it stands in for a measurement.
 */
export function parseRecordedMeasurements(
  measurements: string,
): readonly { viewport: number; scrollWidth: number; clientWidth: number; diff: number }[] {
  return [...measurements.matchAll(/(\d+)px:\s*(\d+)px\/(\d+)px \(diff (\d+)\)/g)].map((m) => ({
    viewport: Number(m[1]),
    scrollWidth: Number(m[2]),
    clientWidth: Number(m[3]),
    diff: Number(m[4]),
  }));
}

describe("scrollable regions accessibility ratchet (am-bc6s)", () => {
  test("no file exceeds its recorded baseline, and no new file introduces unreachable scrolling regions", () => {
    const tsxFiles = findFiles(join(ROOT, "src"), ".tsx");
    const regressions: string[] = [];
    const improvements: string[] = [];

    for (const file of tsxFiles) {
      const rel = relative(ROOT, file);
      const count = countUnreachableScrollRegions(readFileSync(file, "utf8"), rel);
      const allowed = BASELINE.get(rel) ?? 0;

      const verdict = classifyAgainstBaseline(rel, count, allowed);
      if (verdict.regression) regressions.push(verdict.regression);
      if (verdict.slack) improvements.push(verdict.slack);
    }

    assert.deepEqual(
      regressions,
      [],
      `Unreachable scrollable regions increased:\n${regressions.join("\n")}\n` +
        "A scrollable region must be keyboard-focusable (tabIndex={0}) with an accessible name, " +
        "or recorded in RECORDED_NON_OVERFLOWING if proven not to overflow. See am-bc6s.",
    );

    assert.deepEqual(
      improvements,
      [],
      `Ratchet pawl engaged: ${improvements.length} baseline entr(y/ies) are now slack:\n${improvements.join("\n")}\n` +
        "Tighten BASELINE to the observed count in this same commit to permanently lock in the improvement. " +
        "A baseline left above the real count is pre-authorised headroom for a future regression. See am-bc6s.",
    );
  });

  test("every scrollable class in the CSS is either audited or recorded as not yet audited", () => {
    const derived = deriveScrollClassesFromCss(ROOT);
    assert.ok(
      derived.size > 20,
      `deriveScrollClassesFromCss found only ${derived.size} classes; the CSS scan is broken, not the coverage`,
    );

    const audited = new Set(AUDITED_SCROLL_CLASSES);
    const unclassified = [...derived]
      .filter((cls) => !audited.has(cls) && !NOT_YET_AUDITED.has(cls))
      .sort();
    assert.deepEqual(
      unclassified,
      [],
      `These classes declare a scrolling overflow in CSS and the ratchet looks at none of them: ${unclassified.join(", ")}. ` +
        "Add each to AUDITED_SCROLL_CLASSES, or to NOT_YET_AUDITED with its current violation count.",
    );

    // A recorded class that no longer declares scrolling, or that has been promoted to AUDITED,
    // is a stale entry. The ledger states a shortfall; it must not outlive one.
    // am-a14x, second half. The check above proves the derived set is covered. It does NOT prove
    // the audited set is real: an entry naming a class no stylesheet declares would sit there
    // forever, auditing nothing, while making the coverage ratio look better than it is. A derived
    // denominator nobody checks against is the same trap one level up.
    const auditedButUndeclared = AUDITED_SCROLL_CLASSES.filter((cls) => !derived.has(cls)).sort();
    assert.deepEqual(
      auditedButUndeclared,
      [],
      `These classes are audited but no stylesheet declares a scrolling overflow for them: ${auditedButUndeclared.join(", ")}. ` +
        "Either the class was renamed or removed and the entry is dead weight, or its CSS rule was " +
        "lost and the regions it names are no longer scrollable.",
    );

    const stale = [...NOT_YET_AUDITED.keys()]
      .filter((cls) => !derived.has(cls) || audited.has(cls))
      .sort();
    assert.deepEqual(
      stale,
      [],
      `These NOT_YET_AUDITED entries no longer describe a gap: ${stale.join(", ")}. Delete them.`,
    );
  });

  test("every scrolling rule whose target carries no class is placed on purpose (am-unaudited-scroll-regions-r4jx)", () => {
    const found: { file: string; line: number; selector: string }[] = [];
    let files = 0;
    let scrollingRules = 0;
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile() && entry.name.endsWith(".css")) {
          files++;
          const css = stripCssComments(readFileSync(full, "utf8"));
          scrollingRules += [...css.matchAll(/\{[^{}]*overflow(?:-x|-y)?\s*:\s*(?:auto|scroll)\b/g)]
            .length;
          for (const target of classlessScrollTargets(css))
            found.push({ file: relative(ROOT, full), ...target });
        }
      }
    };
    walk(join(ROOT, "src"));
    // The denominator, so a scan that read nothing cannot pass as a clean one.
    assert.ok(files > 50, `the CSS walk found only ${files} stylesheets`);
    assert.ok(scrollingRules > 20, `the CSS walk found only ${scrollingRules} scrolling rules`);

    const unplaced = found
      .filter((t) => !CLASSLESS_SCROLL_TARGETS.has(t.selector))
      .map((t) => `${t.file}:${t.line} ${t.selector}`);
    assert.deepEqual(
      unplaced,
      [],
      "These rules make an element scroll that no class names, so the class-based audit cannot see " +
        "it. Give the scrolling element a class the audit lists, or record here how a keyboard reaches it.",
    );
    const stale = [...CLASSLESS_SCROLL_TARGETS.keys()].filter(
      (selector) => !found.some((t) => t.selector === selector),
    );
    assert.deepEqual(stale, [], `No stylesheet has these rules any more: ${stale.join(", ")}`);
  });

  test("classlessScrollTargets reports the rules the class scan cannot see, and only those", () => {
    const selectors = (css: string) => classlessScrollTargets(css).map((t) => t.selector);
    // The two real cases, verbatim. The first is globals.css at 0b505d9a: its only class is inside
    // :has(), on the table, so it names no scrolling element.
    assert.deepEqual(selectors("div:has(> table.data-table) {\n  overflow-x: auto;\n}\n"), [
      "div:has(> table.data-table)",
    ]);
    assert.deepEqual(selectors(".linear-formula > [aria-hidden] {\n  overflow-x: auto;\n}"), [
      ".linear-formula > [aria-hidden]",
    ]);
    // A class on the target is the class scan's business, whatever sits above it.
    assert.deepEqual(
      selectors(".table-scroll { overflow-x: auto }\n.a > .b { overflow: scroll }"),
      [],
    );
    assert.deepEqual(
      selectors("section.linear-formula-scroll:focus-visible { overflow: auto }"),
      [],
    );
    // In a list, only the class-less member; a class inside :not() does not count.
    assert.deepEqual(selectors(".a, pre:not(.b) { overflow-y: auto }"), ["pre:not(.b)"]);
    // Not scrolling, or inside a comment: nothing.
    assert.deepEqual(selectors("pre { overflow: hidden }\n/* div { overflow: auto } */"), []);
    // Inside @media, with the rule's own line.
    assert.deepEqual(
      classlessScrollTargets("@media (max-width: 30em) {\n  pre {\n    overflow-x: auto;\n  }\n}"),
      [{ line: 2, selector: "pre" }],
    );
  });

  test("planted negative: a count below baseline is reported as slack (ratchet pawl)", () => {
    const slack = classifyAgainstBaseline("src/components/lab/Fake.tsx", 1, 2);
    assert.equal(slack.slack, "src/components/lab/Fake.tsx: 1 < 2");
    assert.equal(slack.regression, undefined);

    const regression = classifyAgainstBaseline("src/components/lab/Fake.tsx", 3, 2);
    assert.ok(regression.regression?.includes("3 unreachable scroll region(s), baseline 2"));
    assert.equal(regression.slack, undefined);

    // At baseline, neither side fires.
    assert.deepEqual(classifyAgainstBaseline("src/components/lab/Fake.tsx", 2, 2), {});
  });

  // am-uj6w: the escape the failure message has always prescribed, now read.
  const MEASURED = "src/components/lab/TrajectoryInspection.tsx";
  const UNMEASURED = "src/components/lab/Unmeasured.tsx";
  const unreachable = '<section className="table-scroll" aria-label="T">rows</section>';

  test("am-uj6w half one: a MEASURED non-overflowing region may drop its tabIndex", () => {
    // TrajectoryInspection's table-scroll is recorded with measurements at 320px and 1280px.
    assert.equal(
      countUnreachableScrollRegions(unreachable, MEASURED),
      0,
      "a recorded element without tabIndex is not counted",
    );
  });

  test("am-uj6w half two: an UNMEASURED region that scrolls may NOT drop its tabIndex", () => {
    // Identical markup, identical class, a file nobody measured. Without this half the fix
    // would be indistinguishable from deleting the check.
    assert.equal(countUnreachableScrollRegions(unreachable, UNMEASURED), 1);
    // And with no file at all, nothing is exempt: the safe default.
    assert.equal(countUnreachableScrollRegions(unreachable), 1);
  });

  test("am-uj6w: the escape is per ELEMENT, so one measurement does not excuse a whole class", () => {
    // "table-scroll" is recorded for TrajectoryInspection and for IonizationLab. A class-level
    // exemption would have excused every other use of it in the repository at once.
    assert.equal(countUnreachableScrollRegions(unreachable, "src/components/lab/WalkLab.tsx"), 1);
  });

  test("am-uj6w: a STALE record fails - measurements that themselves show overflow", () => {
    const overflowing = {
      file: MEASURED,
      className: "table-scroll",
      url: "/x/",
      measurements: "320px: 900px/254px (diff 646); 1280px: 1150px/1150px (diff 0)",
      reason: "recorded before the table grew a column",
      measuredBy: "test",
    } as const;
    const why = staleReason(overflowing, () => 'className="table-scroll"');
    assert.ok(why?.includes("show overflow at 320px 900/254"), why);
    assert.ok(why?.includes("must keep its tabIndex"), why);
  });

  test("a record measured while the element was not laid out is refused, not honoured", () => {
    // 0/0 shows no overflow, so the old check honoured it. It is not evidence the region fits.
    // Measured 2026-09-22: of construction-table-wrap's 74 rendered instances across 29 built
    // pages, SEVENTY report 0/0 at 320px because they sit inside a collapsed section on the
    // papers routes. Auditing that class page by page would have produced seventy passing
    // exemptions from elements that never appeared.
    const base = {
      file: MEASURED,
      className: "table-scroll",
      url: "/x/",
      measurements: "320px: 254px/254px (diff 0)",
      reason: "r",
      measuredBy: "test",
    } as const;
    const src = () => 'className="table-scroll"';

    const notLaidOut = staleReason({ ...base, measurements: "320px: 0px/0px (diff 0)" }, src);
    assert.ok(notLaidOut?.includes("not laid out"), notLaidOut);
    assert.ok(notLaidOut?.includes("re-measure"), notLaidOut);

    // One zero among several good viewports is still a refusal: the region was not measured at
    // that width, and a partial measurement must not pass as a whole one.
    const oneZero = staleReason(
      { ...base, measurements: "320px: 0px/0px (diff 0); 1280px: 900px/900px (diff 0)" },
      src,
    );
    assert.ok(oneZero?.includes("not laid out"), oneZero);

    // The accept half: a genuinely measured, genuinely fitting region is still honoured.
    assert.equal(staleReason(base, src), undefined);
  });

  test("am-uj6w: a STALE record fails - the element is gone, or the numbers do not parse", () => {
    const base = {
      file: MEASURED,
      className: "table-scroll",
      url: "/x/",
      measurements: "320px: 254px/254px (diff 0)",
      reason: "r",
      measuredBy: "test",
    } as const;
    assert.ok(staleReason(base, () => undefined)?.includes("no longer exists"));
    assert.ok(staleReason(base, () => "nothing relevant here")?.includes("no longer carries"));
    assert.ok(
      staleReason(
        { ...base, measurements: "measured, looked fine" },
        () => 'className="table-scroll"',
      )?.includes("do not parse"),
    );
    // The genuine case still passes, so this is not a check that refuses everything.
    assert.equal(
      staleReason(base, () => 'className="table-scroll"'),
      undefined,
    );
  });

  // am-afam: the accessible name is checked as a RELATION, not as a substring.
  const ROD = "src/components/lab/RodSimultaneityLab.tsx";
  const rodSource = () => readFileSync(join(ROOT, ROD), "utf8");
  const rodRecord = {
    file: ROD,
    className: "table-scroll",
    ariaLabel: "Values at these settings",
    url: "/lab/sr-04/",
    measurements: "320px: 254px/254px (diff 0); 1280px: 704px/704px (diff 0)",
    reason: "the values table fits at both viewports; the event table above it does not",
    measuredBy: "test",
  } as const;

  test("am-afam: a name belonging to a DIFFERENT element in the same file is refused", () => {
    // The fixture is TanElk's plant, kept as a fixture instead of a one-off run.
    // "Rod measurement and simultaneity settings" is a real aria-label in this same
    // file, on the settings form, which is neither a table-scroll nor a scroll region.
    // It was "Predict before calculating", a summary that predict mode's gate replaces
    // (dispatch 156); the reachability assertion below is what said to move it.
    const impostor = "Rod measurement and simultaneity settings";
    const src = rodSource();

    // Reachability first: the state being refused is one the OLD check accepted.
    // If the file stopped carrying this string the plant would be vacuous - it
    // would pass the new check for the wrong reason and prove nothing.
    assert.ok(
      src.includes(impostor),
      `${impostor} is no longer in ${ROD}; pick another real label from a non-table-scroll element or the plant is vacuous`,
    );
    assert.ok(
      !accessibleNamesForClass(src, "table-scroll").includes(impostor),
      "and it must not be a table-scroll's own name, or there is nothing to discriminate",
    );

    const why = staleReason({ ...rodRecord, ariaLabel: impostor }, rodSource);
    assert.ok(why?.includes("carries the accessible name"), why);
    assert.ok(why?.includes(impostor), why);
  });

  test("am-afam control: the genuine name still passes, and an unnamed record is untouched", () => {
    // Without this half a check that refuses everything looks like a fix.
    assert.equal(staleReason(rodRecord, rodSource), undefined);

    // The other table-scroll in the same file - the one that overflows and keeps
    // its tabIndex - is a real name of the right class, so the relation is not
    // satisfied by "the only name in the file" either.
    assert.equal(
      staleReason(
        { ...rodRecord, ariaLabel: "Spacetime event coordinates and invariant interval table" },
        rodSource,
      ),
      undefined,
    );

    // Records with no accessible name are keyed and checked exactly as before:
    // the new arm is entered only when ariaLabel is present.
    const unnamed = {
      file: MEASURED,
      className: "table-scroll",
      url: "/x/",
      measurements: "320px: 254px/254px (diff 0)",
      reason: "r",
      measuredBy: "test",
    } as const;
    assert.equal(
      staleReason(unnamed, () => 'className="table-scroll"'),
      undefined,
    );
    assert.equal(
      [...RECORDED_NON_OVERFLOWING.keys()].filter((k) => k.split("::").length === 2).length,
      RECORDED_NON_OVERFLOWING.size - 1,
      "exactly one record is keyed by three parts; the rest keep their two-part keys",
    );
  });

  test("am-uj6w: every committed record is live, parseable and not stale", () => {
    const stale: string[] = [];
    for (const record of RECORDED_NON_OVERFLOWING.values()) {
      const why = staleReason(record, (f) => {
        const abs = join(ROOT, f);
        return existsSync(abs) ? readFileSync(abs, "utf8") : undefined;
      });
      if (why) stale.push(why);
      assert.ok(record.reason.length >= 20, `${record.file}: reason too short to be a reason`);
      assert.ok(record.measuredBy.length > 0, `${record.file}: no measurer recorded`);
    }
    assert.deepEqual(stale, [], `Stale non-overflow records:\n${stale.join("\n")}`);
  });

  test("the detector catches an unreachable scrollable container", () => {
    const unfocusable = '<section className="table-scroll" aria-label="Table">content</section>';
    assert.equal(countUnreachableScrollRegions(unfocusable), 1);

    const focusable =
      '<section className="table-scroll" aria-label="Table" tabIndex={0}>content</section>';
    assert.equal(countUnreachableScrollRegions(focusable), 0);

    const nonAudited = '<div className="some-other-class">content</div>';
    assert.equal(countUnreachableScrollRegions(nonAudited), 0);
  });
});

describe("the recorded measurements are read, not merely stored (am-uj6w)", () => {
  test("every entry parses into both viewports and its own numbers agree", () => {
    for (const [key, record] of RECORDED_NON_OVERFLOWING) {
      const readings = parseRecordedMeasurements(record.measurements);
      assert.equal(
        readings.length,
        2,
        `${key}: measurements must record both 320px and 1280px, got "${record.measurements}"`,
      );
      assert.deepEqual(
        readings.map((r) => r.viewport).sort((a, b) => a - b),
        [320, 1280],
        `${key}: the two viewports must be 320px and 1280px`,
      );
      for (const r of readings) {
        assert.equal(
          r.scrollWidth,
          r.clientWidth,
          `${key} @${r.viewport}px: recorded as non-overflowing but scrollWidth ${r.scrollWidth} != clientWidth ${r.clientWidth}`,
        );
        assert.equal(
          r.diff,
          0,
          `${key} @${r.viewport}px: recorded diff is ${r.diff}, so this element overflows and must keep its tabIndex`,
        );
      }
    }
  });
});

describe("the CSS reader reads rules, not the prose about them", () => {
  // Both directions, because a stripper that removed everything would report no scrolling
  // classes at all and this gate would pass forever. The phantom case is the one that actually
  // happened: see stripCssComments.
  test("a class named only inside a comment is not a selector", () => {
    const css = `
/* .foundation-construction content box is 358 - 48 padding, and .phantom-class too */
div:has(> table.data-table) {
  overflow-x: auto;
}
`;
    const stripped = stripCssComments(css);
    assert.ok(!stripped.includes("foundation-construction"), "comment class must not survive");
    assert.ok(!stripped.includes("phantom-class"), "comment class must not survive");
    assert.ok(stripped.includes("table.data-table"), "the real selector must survive");
    assert.ok(stripped.includes("overflow-x: auto"), "the real declaration must survive");
  });

  test("a comment between a closing brace and a selector does not swallow the selector", () => {
    // This is the exact shape that produced the phantoms: the rule matcher treats everything
    // since the previous } as the selector, so the comment has to be blanked in place rather
    // than left to merge the two.
    const css = `.a { color: red; }\n/* .commented-only */\n.real-scroller { overflow-y: scroll; }`;
    const stripped = stripCssComments(css);
    assert.ok(stripped.includes(".real-scroller"), "the following selector must survive");
    assert.ok(!stripped.includes("commented-only"), "the comment class must not");
  });

  test("line numbers are preserved so any reported offset still points at the right line", () => {
    const css = "/* one\n   two\n   three */\n.x { overflow: auto; }";
    assert.equal(stripCssComments(css).split("\n").length, css.split("\n").length);
  });

  test("the derived set is not empty, or the phantom fix would have silenced the gate", () => {
    // A positive control over the real tree. Stripping comments removes classes; if it removed
    // all of them this gate would report a clean repository and mean nothing.
    assert.ok(
      deriveScrollClassesFromCss().size > 5,
      "stripping comments must not empty the scrolling-class population",
    );
  });
});
