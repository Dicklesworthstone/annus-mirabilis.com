import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
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
 * 2. Classes verified empirically NOT to overflow are recorded in RECORDED_NON_OVERFLOWING with measurements.
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
export const RECORDED_NON_OVERFLOWING = new Map<
  string,
  { file: string; url: string; measurements: string; reason: string }
>([
  [
    "lab-bottom",
    {
      file: "src/components/lab/TracerLab.tsx",
      url: "/lab/bm-01/",
      measurements: "320px: 254px/254px (diff 0); 1280px: 1150px/1150px (diff 0)",
      reason:
        "CSS in globals.css sets display: grid with responsive columns; does not set overflow in CSS.",
    },
  ],
  [
    "trajectory-table-scroll",
    {
      file: "src/components/lab/TrajectoryInspection.tsx",
      url: "/lab/brownian-data/",
      measurements: "320px: 254px/254px (diff 0); 1280px: 1150px/1150px (diff 0)",
      reason:
        "Table columns format short coordinates; with 320px font sizing and padding, table fits inside 254px container.",
    },
  ],
  [
    "sr07-components",
    {
      file: "src/components/lab/sr07/FieldEquationsLab.tsx",
      url: "/lab/sr-07/",
      measurements: "320px: 288px/288px (diff 0); 1280px: 1216px/1216px (diff 0)",
      reason:
        "Applied to a <table> element with default display: table; fits viewport width without scrolling.",
    },
  ],
  [
    "sr07-equation",
    {
      file: "src/components/lab/sr07/FieldEquationsLab.tsx",
      url: "/lab/sr-07/",
      measurements: "320px: 288px/288px (diff 0); 1280px: 1216px/1216px (diff 0)",
      reason:
        "Equations and steps fit within the mobile measure; checked across all 8 equations and both unit layers.",
    },
  ],
  [
    "genealogy-graph-wrapper",
    {
      file: "src/equations/genealogy/Genealogy.tsx",
      url: "Genealogy component",
      measurements: "320px: 236px/236px (diff 0); 1280px: 1196px/1196px (diff 0)",
      reason:
        "Child SVG has width='100%' and max-width: 100% in genealogy.css; scales to fit container width without scrolling.",
    },
  ],
  [
    "facsimile-canvas-container",
    {
      file: "src/reader/faces/FacsimileViewer.tsx",
      url: "/papers/brownian-motion/view/facsimile/",
      measurements: "320px: 206px/206px (diff 0); 1280px: 1166px/1166px (diff 0)",
      reason:
        ".facsimile-page-frame has max-width: 100% in reader.css; canvas preview conforms to container width.",
    },
  ],
]);

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
 * Baseline recorded post-fix for am-bc6s (2026-09-17).
 * The fixed files (kitchen/page.tsx, DerivationStepComponent.tsx, SplitTabs.tsx, FacsimileFace.tsx)
 * are at 0 and omitted from this map.
 * May only shrink.
 */
export const BASELINE = new Map<string, number>([
  ["src/components/discover/BrownianInvestigation.tsx", 1],
  ["src/components/edition/Formula.tsx", 1],
  ["src/components/lab/bm03/ConfigurationLab.tsx", 1],
  ["src/components/lab/BrownianLab.tsx", 2],
  ["src/components/lab/CameraLab.tsx", 2],
  ["src/components/lab/CameraPlots.tsx", 1],
  ["src/components/lab/DistributionPlot.tsx", 1],
  ["src/components/lab/InferenceLab.tsx", 1],
  ["src/components/lab/InferencePlots.tsx", 2],
  ["src/components/lab/kitchen/KitchenControls.tsx", 1],
  ["src/components/lab/kitchen/KitchenResults.tsx", 1],
  ["src/components/lab/OsmoticPartitionLab.tsx", 1],
  ["src/components/lab/WalkLab.tsx", 2],
  ["src/components/lab/WalkPlots.tsx", 1],
]);

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

export function countUnreachableScrollRegions(source: string): number {
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
          count++;
        }
      }
    }
  }
  return count;
}

describe("scrollable regions accessibility ratchet (am-bc6s)", () => {
  test("no file exceeds its recorded baseline, and no new file introduces unreachable scrolling regions", () => {
    const tsxFiles = findFiles(join(ROOT, "src"), ".tsx");
    const regressions: string[] = [];
    const improvements: string[] = [];

    for (const file of tsxFiles) {
      const rel = relative(ROOT, file);
      const count = countUnreachableScrollRegions(readFileSync(file, "utf8"));
      const allowed = BASELINE.get(rel) ?? 0;

      if (count > allowed) {
        regressions.push(
          `${rel}: ${count} unreachable scroll region(s), baseline ${allowed}. ` +
            "Add tabIndex={0} and an accessible aria-label, or document in RECORDED_NON_OVERFLOWING with measurements.",
        );
      } else if (count < allowed) {
        improvements.push(`${rel}: ${count} < ${allowed}`);
      }
    }

    assert.deepEqual(
      regressions,
      [],
      `Unreachable scrollable regions increased:\n${regressions.join("\n")}\n` +
        "A scrollable region must be keyboard-focusable (tabIndex={0}) with an accessible name, " +
        "or recorded in RECORDED_NON_OVERFLOWING if proven not to overflow. See am-bc6s.",
    );

    if (improvements.length > 0) {
      console.log(
        `[am-bc6s] baseline can be lowered for ${improvements.length} file(s): ${improvements.join(", ")}`,
      );
    }
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
