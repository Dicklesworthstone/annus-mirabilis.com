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
  readonly url: string;
  /** "320px: 254px/254px (diff 0); 1280px: 1150px/1150px (diff 0)" - parsed, not just stored. */
  readonly measurements: string;
  readonly reason: string;
  readonly measuredBy: string;
}

/** The key a record is looked up by: one ELEMENT, not one class. */
export function recordKey(file: string, className: string): string {
  return `${file}::${className}`;
}

export const RECORDED_NON_OVERFLOWING: ReadonlyMap<string, NonOverflowingRecord> = new Map(
  (
    [
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
          'Reached only through the "Table & Numeric Inputs" tab of the step-1 interaction mode; the default tab renders the visual number line and this element is absent, so a measurement of the page as loaded finds nothing. Measured after clicking that tab, which is the only state in which a reader sees it. The table has four fixed columns of short signed numbers and does not grow with reader input. The file carries exactly one element of this class.',
        measuredBy: "am-bc6s",
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
    ] satisfies readonly NonOverflowingRecord[]
  ).map((r) => [recordKey(r.file, r.className), r]),
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

/** A record is honoured only while its own numbers still say the region does not overflow. */
export function staleReason(
  record: NonOverflowingRecord,
  sourceOfFile: (file: string) => string | undefined,
): string | undefined {
  const parsed = parseMeasurements(record.measurements);
  if (parsed.length === 0) {
    return `${recordKey(record.file, record.className)}: measurements do not parse: "${record.measurements}"`;
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
  return undefined;
}

/**
 * Classes that specify scrolling in CSS and must be focusable when rendered.
 */
export const AUDITED_SCROLL_CLASSES = [
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
  ["construction-table-wrap", 4],
  ["controlled-comparison", 1],
  ["countermodel-scroll", 0],
  ["data-panel-table-wrap", 2],
  ["encounter-table", 2],
  ["equation-body", 2],
  ["facsimile-canvas-container", 1],
  ["facsimile-stage", 1],
  ["genealogy-graph-wrapper", 1],
  ["inference-workbench", 0],
  ["kitchen-guide", 1],
  ["kitchen-lab", 1],
  ["latex-block-wrapper", 1],
  ["linear-formula", 2],
  ["low-speed-table", 1],
  ["mass-energy-investigation", 1],
  ["me-table", 0],
  ["missing-step-math", 0],
  ["missing-step-table", 1],
  ["notebook-dialog", 0],
  ["notebook-replay", 0],
  ["reader-bottom-sheet", 1],
  ["reader-sticky-lab", 1],
  ["replay-table", 0],
  ["scale-facts-table-wrap", 1],
  ["search-dialog", 0],
  ["search-results", 0],
  ["show-the-code", 4],
  ["source-equation", 1],
  ["sr07-components", 1],
  ["sr07-equation", 1],
  ["table-scroll-container", 1],
  ["table-wrapper", 2],
  ["trajectory-table-scroll", 1],
  ["video-observation-scroll", 1],
]);

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
        const css = readFileSync(full, "utf8");
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
  const tagRegex = /<([a-zA-Z0-9_-]+)\b([^>]*?)>/gs;
  for (const match of source.matchAll(tagRegex)) {
    const attrs = match[2] ?? "";
    const classAttrMatch = attrs.match(/className\s*=\s*(?:\{`([^`]+)`\}|"([^"]+)"|'([^']+)')/s);
    if (!classAttrMatch) continue;
    const classStr = classAttrMatch[1] ?? classAttrMatch[2] ?? classAttrMatch[3] ?? "";
    const classes = classStr.split(/\s+/).filter(Boolean);

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
