import { describe, expect, it } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadHistoricalDataset } from "../content/datasets/loader.ts";
import { getOwnerTheoreticalLine } from "../experiments/lq08/millikan.ts";
import { loadMillikanOverlay } from "../experiments/lq08/millikanRecord.ts";
import { getConstantSet } from "../physics/reference/constants.ts";

/**
 * LQ-08's Millikan overlay is the record, not a copy of it (am-lq-08-photoelectric-va5a,
 * am-data-millikan-1916-zh2q). The points used to be typed into millikan.ts beside the record, so
 * the record could change and the plot would not follow.
 */
describe("the Millikan 1916 sodium record and LQ-08's overlay", () => {
  const record = loadHistoricalDataset(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../../content/datasets/millikan-1916-sodium.yaml",
    ),
  );

  it("draws exactly the record's rows, in order, while the record stands", () => {
    expect(record.evidenceStatus).toBe("historical-measurement");
    const nu = record.columns.findIndex((c) => c.quantityId === "frequency" && c.unit === "Hz");
    const v = record.columns.findIndex(
      (c) => c.quantityId === "stoppingPotentialMagnitude" && c.unit === "V",
    );
    const value = (cell: (typeof record.rows)[number]["cells"][number] | undefined) =>
      cell?.kind === "number" ? cell.value : Number.NaN;
    const rows = record.rows.map((r) => ({
      frequencyHz: value(r.cells[nu]),
      stoppingPotentialVolts: value(r.cells[v]),
    }));
    expect(rows.length).toBeGreaterThan(2);

    const overlay = loadMillikanOverlay();
    expect(overlay.kind).toBe("plottable");
    if (overlay.kind !== "plottable") return;
    expect(overlay.points).toEqual(rows);
    expect(overlay.citation).toContain("A Direct Photoelectric Determination of Planck");
  });

  it("enforces epistemic separation: theoretical model line slope is strictly owner-derived, never fit-derived", () => {
    const set = getConstantSet("modern-si-2019");
    const theoreticalLine = getOwnerTheoreticalLine(2.2, set);
    expect(theoreticalLine.source).toBe("owner");
    // Theoretical h/e = 6.62607015e-34 / 1.602176634e-19 ≈ 4.135667697e-15 V s
    expect(theoreticalLine.slope).toBeCloseTo(4.135667697e-15, 20);
  });
});
