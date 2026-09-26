import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadHistoricalDataset } from "../content/datasets/loader.ts";
import { getDatasetShelfStatus } from "../content/datasets/shelf.ts";
import { getOwnerTheoreticalLine } from "../experiments/lq08/millikan.ts";
import { loadMillikanOverlay } from "../experiments/lq08/millikanRecord.ts";
import generatedOverlay from "../generated/lq08-millikan-overlay.json";
import { getConstantSet } from "../physics/reference/constants.ts";

/**
 * The Millikan 1916 sodium record, read from the printed figure (dispatch 249, am-data-millikan-1916-zh2q).
 *
 * Revision 1 was withdrawn on 2026-09-24: its six rows sat on one straight line to 0.214 mV against a
 * stated 0.01 V, its 312.6 nm row gave a frequency 2.72 percent from c/λ, and the page image it cited
 * never existed. Revision 2 was read from Internet Archive's scan of Phys. Rev. 7, no. 3, which
 * shows the article prints no Table IV and no table of sodium stopping potentials: the points exist
 * only on Fig. 6 (p. 373), as intercepts on the potential axis, signed and uncorrected for the
 * contact E.M.F. The receipt is docs/provenance/datasets/millikan-1916-sodium.md.
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const record = loadHistoricalDataset(resolve(ROOT, "content/datasets/millikan-1916-sodium.yaml"));
const IMAGE = "public/figures/datasets/millikan-1916-sodium/p373-fig6-600dpi.webp";
const RECEIPT = "docs/provenance/datasets/millikan-1916-sodium.md";
const column = (quantityId: string) => record.columns.findIndex((c) => c.quantityId === quantityId);
const numbers = (index: number) =>
  record.rows.map((row) => {
    const cell = row.cells[index];
    return cell?.kind === "number" ? cell.value : Number.NaN;
  });

describe("the Millikan 1916 sodium record, read from Fig. 6 of the scan", () => {
  it("stands as a measurement, revision 2, read by a named digitizer from a committed page image", () => {
    expect(record.evidenceStatus).toBe("historical-measurement");
    expect(record.withdrawal).toBeUndefined();
    expect(record.digitizer.digitizationRevision).toBe(2);
    expect(record.digitizer.name).toBe("agent:GreenOx");
    expect(record.digitizer.sourcePageImage).toBe(IMAGE);
    // The image the record cites is in the repository, whole: the 600 dpi render of Fig. 6.
    expect(existsSync(resolve(ROOT, IMAGE))).toBe(true);
    expect(statSync(resolve(ROOT, IMAGE)).size).toBeGreaterThan(1_000_000);
    // The receipt names the image and the scan it came from.
    const receipt = readFileSync(resolve(ROOT, RECEIPT), "utf8");
    expect(receipt).toContain("p373-fig6-600dpi.webp");
    expect(receipt).toContain("162bab3b468db6220ec0fa4cd4332c728f436485a14f13b0d93d94275fdec5da");
    expect(record.publications[0]?.locator).toEqual({ kind: "figure", number: 6 });
  });

  it("its six rows are the six circled points of Fig. 6, in the order of Table I's headings", () => {
    // The lines are a permanent fact of the 1916 page, so they are named, not counted.
    const lines = record.rows.map((row) => {
      const cell = row.cells[column("wavelength")];
      return cell?.kind === "number" ? cell.originalToken : undefined;
    });
    expect(lines).toEqual(["5,461", "4,339", "4,047", "3,650", "3,126", "2,535"]);
  });

  it("every frequency agrees with c/λ of its printed line to within half a percent", () => {
    // The withdrawn 312.6 nm row was 2.72 percent off. A reading of the printed axis is not.
    const wavelengths = numbers(column("wavelength"));
    const frequencies = numbers(column("frequency"));
    expect(frequencies.length).toBeGreaterThan(0);
    frequencies.forEach((nu, i) => {
      const cOverLambda = 2.99792458e10 / ((wavelengths[i] ?? Number.NaN) * 1e-8);
      expect(Math.abs(nu / cOverLambda - 1), `row ${i}`).toBeLessThan(0.005);
    });
  });

  it("the potentials are the signed intercepts Fig. 6 plots, not stopping-potential magnitudes", () => {
    expect(column("stoppingPotentialMagnitude")).toBe(-1);
    const potentials = numbers(column("photoelectricInterceptPotential"));
    // Every line but 2,535 meets the potential axis on the side of negative volts (p. 372).
    expect(potentials.slice(0, 5).every((v) => v < 0)).toBe(true);
    expect(potentials[5]).toBeGreaterThan(0);
  });

  it("the 2,535 row is the value p. 382 prints", () => {
    const row = record.rows[5];
    const nu = row?.cells[column("frequency")];
    const v = row?.cells[column("photoelectricInterceptPotential")];
    expect(nu?.kind === "number" && nu.originalToken).toBe("118.2 × 10¹³");
    expect(v?.kind === "number" && v.originalToken).toBe(".52");
  });

  it("is not a line through its own points: the five Millikan used scatter as a printed figure does", () => {
    // Revision 1's rows sat within 0.214 mV of a line. Read from the page, these do not, and their
    // slope stays within 2 percent of the 4.124e-15 volt-frequencies Millikan prints (p. 374).
    const nu = numbers(column("frequency")).slice(0, 5);
    const v = numbers(column("photoelectricInterceptPotential")).slice(0, 5);
    const mx = nu.reduce((a, b) => a + b, 0) / nu.length;
    const my = v.reduce((a, b) => a + b, 0) / v.length;
    const sxy = nu.reduce((s, x, i) => s + (x - mx) * ((v[i] ?? 0) - my), 0);
    const sxx = nu.reduce((s, x) => s + (x - mx) ** 2, 0);
    const slope = sxy / sxx;
    const residuals = nu.map((x, i) => (v[i] ?? 0) - (my + slope * (x - mx)));
    expect(Math.abs(slope / 4.124e-15 - 1)).toBeLessThan(0.02);
    expect(Math.max(...residuals.map(Math.abs))).toBeGreaterThan(0.005);
  });

  it("says which five points fixed Millikan's slope, and carries his printed slopes as printed", () => {
    const fit = record.fits?.find((f) => f.id === "millikan-1916-fig6-five-lines");
    expect(fit?.rowsUsed).toEqual([0, 1, 2, 3, 4]);
    // 2,535 is left out, with the page's reason: "five points corresponding to lines 5,461, 4,339,
    // 4,047, 3,651 and 3,125" (p. 374).
    expect(fit?.rowsExcluded.map((e) => e.rowIndex)).toEqual([5]);
    expect(fit?.parameters.map((p) => [p.value, p.source])).toEqual([
      [4.124e-15, "imported"],
      [4.128e-15, "imported"],
    ]);
  });

  it("is later evidence, published in 1916, never on the 1904 shelf", () => {
    const shelf = getDatasetShelfStatus(record);
    expect(shelf.eligible).toBe(false);
    expect(String(shelf.publicationYear)).toContain("1916");
  });

  it("the page and embed read a prepare-time copy that equals what the record yields now", () => {
    // Pages import src/generated/lq08-millikan-overlay.json so no loader enters a route bundle.
    expect(generatedOverlay).toEqual(JSON.parse(JSON.stringify(loadMillikanOverlay())));
  });

  it("enforces epistemic separation: theoretical model line slope is strictly owner-derived, never fit-derived", () => {
    const set = getConstantSet("modern-si-2019");
    const theoreticalLine = getOwnerTheoreticalLine(2.2, set);
    expect(theoreticalLine.source).toBe("owner");
    expect(theoreticalLine.slope).toBeCloseTo(4.135667697e-15, 20);
  });
});
