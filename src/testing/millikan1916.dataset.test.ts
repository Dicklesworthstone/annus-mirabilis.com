import { describe, expect, it } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReactElement } from "react";
import PhotoelectricPage from "../app/lab/lq-08/page.tsx";
import { loadHistoricalDataset } from "../content/datasets/loader.ts";
import { renderEmbeddedLaboratory } from "../experiments/embed/adapters.tsx";
import { getOwnerTheoreticalLine } from "../experiments/lq08/millikan.ts";
import { loadMillikanOverlay } from "../experiments/lq08/millikanRecord.ts";
import { getConstantSet } from "../physics/reference/constants.ts";
import { exportMarkup } from "./exportMarkup.ts";

/**
 * The Millikan 1916 sodium record is withdrawn, and LQ-08 says so instead of plotting it
 * (am-data-millikan-1916-zh2q).
 *
 * The record's six rows sat on one straight line to 0.214 mV against a stated precision of 0.01 V,
 * and its 312.6 nm row gave a frequency 2.7 percent from c/λ with a voltage that still fit the line
 * at the listed frequency. Withdrawal is not deletion: the rows stay on the record for review, and
 * every reader surface that used to show them shows the reason and the citation instead.
 */
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

describe("the withdrawn Millikan 1916 sodium record", () => {
  const record = loadHistoricalDataset(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../../content/datasets/millikan-1916-sodium.yaml",
    ),
  );
  // The measured and derived columns. The wavelength column is left out: it names a mercury line,
  // and the withdrawal reason names the 312.6 nm line on purpose.
  const values = record.rows.flatMap((r) =>
    r.cells.slice(1).flatMap((c) => (c.kind === "number" ? [c.value] : [])),
  );
  // The stopping potentials as the record's own tokens write them.
  const voltages = record.rows
    .map((r) => r.cells[2])
    .flatMap((c) => (c?.kind === "number" && c.originalToken ? [c.originalToken] : []));

  it("is withdrawn with a date and a reason, and keeps its rows for review", () => {
    expect(record.evidenceStatus).toBe("withdrawn");
    expect(record.withdrawal?.date).toBe("2026-09-24");
    expect(record.withdrawal?.reason).toContain("could not be traced to Millikan's printed table");
    // Withdrawal is not deletion.
    expect(record.rows.length).toBeGreaterThan(0);
    expect(voltages.length).toBe(record.rows.length);
  });

  it("reaches LQ-08 as a reason and a citation, with none of its values", () => {
    const overlay = loadMillikanOverlay();
    expect(overlay.kind).toBe("withheld");
    if (overlay.kind !== "withheld") return;
    expect(overlay.reason).toBe(record.withdrawal?.reason ?? "");
    expect(overlay.citation).toContain("A Direct Photoelectric Determination of Planck");
    expect(overlay.citation).toContain("Physical Review");
    const serialized = JSON.stringify(overlay);
    expect(values.length).toBe(record.rows.length * 2);
    for (const value of values) expect(serialized).not.toContain(String(value));
    for (const token of voltages) expect(serialized).not.toContain(token);
  });

  for (const [surface, render] of [
    ["the /lab/lq-08/ page", () => exportMarkup(PhotoelectricPage() as ReactElement)],
    [
      "the /embed/lab/lq-08/ embed",
      async () => exportMarkup((await renderEmbeddedLaboratory("lq-08")) as ReactElement),
    ],
  ] as const) {
    it(`${surface} says Millikan's values are not shown yet and plots none of them`, async () => {
      const html = await render();
      const words = text(html);
      expect(words).toContain("Millikan’s 1916 sodium measurements are not shown yet.");
      expect(words).toContain("could not be traced to Millikan's printed table");
      expect(words).toContain("A Direct Photoelectric Determination of Planck");
      expect(html).not.toContain('data-testid="millikan-dataset"');
      expect(words).not.toContain("Show Millikan’s 1916 sodium measurements");
      expect(words).not.toContain("Slope fitted to them");
      // The stopping plot is still there: the note replaced the points, not the instrument.
      expect(html).toContain('data-view-id="lq-08-stopping-plot"');
    });
  }

  it("enforces epistemic separation: theoretical model line slope is strictly owner-derived, never fit-derived", () => {
    const set = getConstantSet("modern-si-2019");
    const theoreticalLine = getOwnerTheoreticalLine(2.2, set);
    expect(theoreticalLine.source).toBe("owner");
    // Theoretical h/e = 6.62607015e-34 / 1.602176634e-19 ≈ 4.135667697e-15 V s
    expect(theoreticalLine.slope).toBeCloseTo(4.135667697e-15, 20);
  });
});
