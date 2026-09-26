import { describe, expect, it } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReactElement } from "react";
import PhotoelectricPage from "../app/lab/lq-08/page.tsx";
import { loadHistoricalDataset } from "../content/datasets/loader.ts";
import { renderEmbeddedLaboratory } from "../experiments/embed/adapters.tsx";
import { loadMillikanOverlay } from "../experiments/lq08/millikanRecord.ts";
import { constantValue, getConstantSet } from "../physics/reference/constants.ts";
import { exportMarkup } from "./exportMarkup.ts";

/**
 * LQ-08's Millikan 1916 panel (dispatch 249, TanElk's ruling on 40650).
 *
 * Millikan's Fig. 6 plots the intercepts of his photocurrent curves on the potential axis, signed
 * and uncorrected for the contact E.M.F.: not the model's stopping potentials. So the panel draws
 * them on his own signed-volt scale, beside the model, and compares the slopes: the line through
 * the five points he says fixed it, the slopes he printed, and h/e from the laboratory's constants.
 * It is labelled 1916 and later evidence, never on the 1904 shelf, and no contact-potential shift
 * is invented to move the points onto the model's axis.
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const record = loadHistoricalDataset(resolve(ROOT, "content/datasets/millikan-1916-sodium.yaml"));
const col = (id: string) => record.columns.findIndex((c) => c.quantityId === id);
const cellValue = (row: (typeof record.rows)[number], id: string) => {
  const cell = row.cells[col(id)];
  return cell?.kind === "number" ? cell.value : Number.NaN;
};
const RECORD_POINTS = record.rows.map((row) => ({
  frequencyHz: cellValue(row, "frequency"),
  interceptVolts: cellValue(row, "photoelectricInterceptPotential"),
}));
const USED = record.fits?.find((f) => f.id === "millikan-1916-fig6-five-lines")?.rowsUsed ?? [];

/** The panel's markup, cut out of a page's. */
function panelOf(html: string): string {
  const start = html.indexOf('data-testid="millikan-fig6-panel"');
  if (start < 0) return "";
  const open = html.lastIndexOf("<section", start);
  const close = html.indexOf("</section>", start);
  return html.slice(open, close + "</section>".length);
}
const circles = (markup: string) =>
  [...markup.matchAll(/<circle[^>]*data-intercept-volts="([^"]+)"[^>]*>/g)].map((m) => {
    const tag = m[0];
    return {
      frequencyHz: Number(/data-frequency-hz="([^"]+)"/.exec(tag)?.[1]),
      interceptVolts: Number(m[1]),
      used: /data-used-for-slope="true"/.test(tag),
    };
  });
const text = (html: string) =>
  html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

describe("LQ-08 shows Millikan's 1916 sodium points on his own scale, beside the model", () => {
  const overlay = loadMillikanOverlay(ROOT);

  it("fits the line to the five points the record says fixed his slope, and sets h/e from the constants beside it", () => {
    expect(overlay.kind).toBe("plottable");
    if (overlay.kind !== "plottable") return;
    // Non-vacuity: the record names five rows used and one excluded.
    expect(USED).toEqual([0, 1, 2, 3, 4]);
    // An independent least-squares slope over the same five rows of the record.
    const pts = USED.map((i) => RECORD_POINTS[i] ?? { frequencyHz: Number.NaN, interceptVolts: 0 });
    const mx = pts.reduce((a, p) => a + p.frequencyHz, 0) / pts.length;
    const my = pts.reduce((a, p) => a + p.interceptVolts, 0) / pts.length;
    const slope =
      pts.reduce((a, p) => a + (p.frequencyHz - mx) * (p.interceptVolts - my), 0) /
      pts.reduce((a, p) => a + (p.frequencyHz - mx) ** 2, 0);
    expect(overlay.fittedSlopeVs / slope - 1).toBeCloseTo(0, 10);
    // Six points would give a different slope: the fit really is over the five.
    expect(Math.abs(overlay.fittedSlopeVs / 4.0712e-15 - 1)).toBeGreaterThan(1e-4);
    // The printed slopes, as the record carries them, and h/e from the constant set.
    expect(overlay.printedSlopes.map((s) => s.slopeVs)).toEqual([4.124e-15, 4.128e-15]);
    const set = getConstantSet("modern-si-2019");
    expect(overlay.modelLineSlopeVs).toBe(
      constantValue(set, "planckConstant").value / constantValue(set, "elementaryCharge").value,
    );
    expect(overlay.modelLineSource).toBe("owner");
    expect(overlay.evidenceLabel).toBe("later evidence, published 1916");
  });

  for (const [surface, render] of [
    ["the /lab/lq-08/ page", () => exportMarkup(PhotoelectricPage() as ReactElement)],
    [
      "the /embed/lab/lq-08/ embed",
      async () => exportMarkup((await renderEmbeddedLaboratory("lq-08")) as ReactElement),
    ],
  ] as const) {
    it(`${surface} draws every record point where the record puts it, on his scale, labelled later evidence`, async () => {
      const html = await render();
      const panel = panelOf(html);
      expect(panel).not.toBe("");
      const words = text(panel);
      expect(words).toContain("Millikan, 1916");
      expect(words).toContain("Later evidence, published 1916. Not on the 1904 shelf.");
      // The points are the record's, value for value: nothing shifted by a contact potential.
      const drawn = circles(panel);
      expect(drawn.map((p) => [p.frequencyHz, p.interceptVolts])).toEqual(
        RECORD_POINTS.map((p) => [p.frequencyHz, p.interceptVolts]),
      );
      expect(drawn.filter((p) => p.interceptVolts < 0)).toHaveLength(5);
      expect(drawn.map((p) => p.used)).toEqual(RECORD_POINTS.map((_, i) => USED.includes(i)));
      // The line, the printed slopes and h/e are all stated.
      expect(panel).toContain('data-testid="millikan-fig6-line"');
      expect(words).toContain("fitted here to his points as read from the figure");
      expect(words).toContain("Slope from Fig. 6, as printed");
      expect(words).toContain("h/e from this laboratory's constants");
      // The model's stopping plot carries none of his points: they are not on its axis.
      const stop = html.indexOf('data-view-id="lq-08-stopping-plot"');
      const stopEnd = html.indexOf("</svg>", stop);
      expect(stop).toBeGreaterThan(-1);
      expect(circles(html.slice(stop, stopEnd))).toEqual([]);
      expect(html).not.toContain("not shown yet");
    });
  }
});
