/**
 * The Locked Version column of the DECISIONS.md dependency inventory (am-niyd).
 *
 * The column was hand-maintained and nothing read it. `ubs` was recorded at
 * `3.0.0` while the installed binary reports `5.0.3`, and the drift was found by
 * eye rather than by a check, which means the next one would be found the same
 * way or not at all.
 *
 * Three sources of truth, and the rows are split by which one they have:
 *
 * - a package declared in package.json: the manifest decides, and a disagreement
 *   is a defect in the document;
 * - a runtime pinned in package.json (`engines.node`, `packageManager`);
 * - a local binary, which no manifest reaches. Only `ubs --version` can speak
 *   for `ubs`, and CI has no `ubs`, so that comparison SKIPS WITH A REASON
 *   there rather than passing. A skip that reads as a pass is how a column
 *   stops being checked.
 *
 * The rows with no source at all are the other half of the finding: the
 * inventory records versions for packages this project does not depend on.
 * They are pinned here as an exact set so a sixteenth cannot be added quietly.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));

export interface InventoryRow {
  readonly name: string;
  readonly version: string;
  readonly line: number;
}

/** Every `| … | \`name\` | \`version\` | …` row of the inventory table. */
export function parseInventoryRows(markdown: string): InventoryRow[] {
  const rows: InventoryRow[] = [];
  markdown.split("\n").forEach((line, index) => {
    if (!line.startsWith("| ") || line.startsWith("|---")) return;
    const cells = line.split("|").slice(1, -1);
    const name = cells[1]?.match(/`([^`]+)`/)?.[1];
    const version = cells[2]?.match(/`([^`]+)`/)?.[1];
    if (name === undefined || version === undefined) return;
    rows.push({ name, version, line: index + 1 });
  });
  return rows;
}

/**
 * Rows the inventory records that package.json does not declare.
 *
 * Not an exemption: an exact set, asserted below. Four are the `probe-only`
 * capabilities the document already says are "pinned for capabilities not yet
 * adopted"; five are local binaries and runtimes no npm manifest reaches. A row
 * joining this list is a claim that the project pins something it does not use,
 * and it should have to be written down here to make it.
 */
const NOT_IN_PACKAGE_JSON: ReadonlyMap<string, string> = new Map([
  ["node", "runtime, pinned in package.json engines.node rather than as a dependency"],
  ["bun", "runtime, pinned in package.json packageManager"],
  ["ubs", "local binary, no npm manifest reaches it; see the verification note below the table"],
  ["vercel", "local CLI used by the release script, not an app dependency"],
  ["fonttools", "Python tool used by the font subsetting step, not an npm dependency"],
  ["tailwindcss", "probe-only: pinned for a capability not yet adopted (see am-vw1o)"],
  ["autoprefixer", "probe-only: pinned for a capability not yet adopted"],
  ["lucide-react", "probe-only: pinned for a capability not yet adopted"],
  ["three", "probe-only: pinned for a capability not yet adopted"],
  ["@types/three", "probe-only: types for a capability not yet adopted"],
  [
    "pdfjs-dist",
    "probe-only: the facsimile viewer ships vendored pdfjs under public/, not via npm",
  ],
  ["zod", "probe-only: pinned for a capability not yet adopted"],
  ["fflate", "probe-only: pinned for a capability not yet adopted"],
  ["marked", "probe-only: pinned for a capability not yet adopted"],
  ["minisearch", "probe-only: pinned for a capability not yet adopted"],
]);

describe("DECISIONS.md locked versions (am-niyd)", () => {
  const markdown = readFileSync(join(ROOT, "docs", "DECISIONS.md"), "utf8");
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    overrides?: Record<string, string>;
    engines?: { node?: string };
    packageManager?: string;
  };
  const declared: Record<string, string> = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.overrides,
  };
  const rows = parseInventoryRows(markdown);

  it("the table is found and parsed, so a rename cannot empty this suite", () => {
    assert.ok(rows.length >= 20, `expected the inventory table, parsed ${rows.length} rows`);
    assert.ok(rows.some((r) => r.name === "ubs"));
  });

  it("every recorded version of a declared package matches package.json", () => {
    const mismatches: string[] = [];
    let compared = 0;
    for (const row of rows) {
      const spec = declared[row.name];
      if (spec === undefined) continue;
      compared += 1;
      const pinned = spec.replace(/^[\^~]/, "");
      if (pinned !== row.version) {
        mismatches.push(
          `DECISIONS.md:${row.line} records ${row.name} ${row.version}, package.json declares ${spec}`,
        );
      }
    }
    // A comparison that compared nothing is the failure this bead is about.
    assert.ok(compared >= 8, `only ${compared} rows had a manifest to check against`);
    assert.deepEqual(mismatches, []);
  });

  it("the bun row matches packageManager", () => {
    const row = rows.find((r) => r.name === "bun");
    assert.ok(row, "the inventory must carry a bun row");
    const pinned = pkg.packageManager?.match(/^bun@(.+)$/)?.[1];
    assert.ok(pinned, "package.json must pin packageManager to a bun version");
    assert.equal(row.version, pinned);
  });

  it("the rows with no manifest source are exactly the recorded set", () => {
    const unsourced = rows
      .filter((r) => declared[r.name] === undefined)
      .map((r) => r.name)
      .sort();
    assert.deepEqual(
      [...new Set(unsourced)],
      [...NOT_IN_PACKAGE_JSON.keys()].sort(),
      "a row the manifest does not declare must be listed in NOT_IN_PACKAGE_JSON with its reason",
    );
  });

  // am-uj6w's class, found in this file: the message above prescribes "with its
  // reason", and until this assertion existed NOT_IN_PACKAGE_JSON was a plain
  // string[] with nowhere to put one. A contributor obeying the message had no
  // field to write into, and a bare name satisfied the checker. A gate that
  // prescribes a remedy it does not read teaches people to ignore its wording.
  it("every unsourced row carries a reason the gate actually reads", () => {
    for (const [name, reason] of NOT_IN_PACKAGE_JSON) {
      assert.ok(
        reason.trim().length >= 20,
        `${name} must record WHY the manifest does not declare it, not just that it does not`,
      );
    }
  });

  // The ubs row is owner-gated: docs/DECISIONS.md states that which version is
  // the project's pin "is not decided here and must not be guessed", and that
  // changing it is a licence question rather than a number edit. So this does
  // NOT assert the table matches the binary. It asserts the document's own two
  // factual claims still hold, so the note cannot rot into a false statement
  // while the decision waits.
  it("the ubs note's claims about the recorded and installed versions are still true", (t) => {
    const row = rows.find((r) => r.name === "ubs");
    assert.ok(row);
    assert.equal(row.version, "3.0.0", "the note says this table records 3.0.0");
    assert.ok(
      markdown.includes(
        "`ubs --version` on the reference machine reports `UBS Meta-Runner v5.0.3`",
      ),
      "the note must state what the installed tool reports",
    );

    let reported: string;
    try {
      reported = execFileSync("ubs", ["--version"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      // CI has no ubs; the gate chain skips ubs-diff and ubs-staged for the same
      // reason. Reported as skipped, never as a pass.
      t.skip("ubs is not on PATH here, so the installed version cannot be read");
      return;
    }
    const version = reported.match(/v(\d+\.\d+\.\d+)/)?.[1];
    assert.equal(
      version,
      "5.0.3",
      "the installed ubs no longer reports 5.0.3, so the note below the table is now wrong",
    );
  });
});
