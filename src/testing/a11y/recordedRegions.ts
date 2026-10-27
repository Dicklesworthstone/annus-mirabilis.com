/**
 * THE MEASURED NON-OVERFLOWING REGIONS, as data rather than as part of a test file.
 *
 * Extracted from `scrollableRegions.test.ts` (am-14at) so that a check in ANOTHER LANE can read
 * the same records. The reason is mechanical and it is the reason `overflowClasses.test.ts` reads
 * the ratchet's other two lists out of its SOURCE TEXT instead of importing them: a test file's
 * import side effect is test REGISTRATION, so importing the ratchet to get at this map would run
 * its twenty-odd filesystem scans inside the importing suite. Across lanes it is worse than
 * untidy -- a `bun:test` file importing a `node:test` file, or the reverse, registers tests the
 * runner was never asked for, and a bun-lane file imported under `node --test` dies outright on
 * the `bun:` protocol.
 *
 * So the records live here, imported by both:
 *   - `src/testing/a11y/scrollableRegions.test.ts` (bun lane) checks them against the SOURCE:
 *     the element still exists, the numbers parse, no record claims a region that overflows.
 *   - `scripts/e2e/recordedRegionsFit.e2e.test.ts` (node lane) checks them against the BUILT
 *     SITE in a browser: the element is really there, laid out, and really fits at both widths.
 *
 * That split is deliberate and AGENTS.md asks for it in those words: "keep a version of its proof
 * in a DIFFERENT lane from the one it controls". The source half cannot tell whether a hand
 * measurement is still true, and the browser half cannot tell whether a record was deleted. Each
 * is blind to what the other sees.
 */

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
