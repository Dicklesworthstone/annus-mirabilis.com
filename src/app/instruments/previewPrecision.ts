/**
 * The precision a table plate shows a laboratory's value at (TanElk, mail 40667).
 *
 * A plate carries the value its laboratory prints for its default settings, read whole into
 * src/generated/instrument-table-plates.json. Some laboratories print seven significant figures in
 * their readout tables ("2.070974 × 10⁻²⁰ J", "0.006439187 J/m³"), which is the laboratory's own
 * precision for its readout and far more than a catalogue preview can use (AGENTS.md: "Choose
 * displayed precision from the question and the inputs"). The plate shows each such number at four
 * significant figures. The stored value keeps the laboratory's full precision; only the display is
 * rounded.
 *
 * Only a decimal number with more than four significant figures is touched. An integer ("5461",
 * "500000000000000"), an exponent set as a superscript, a unit, and a zero printed to a stated
 * resolution ("0.000000") are left exactly as the laboratory prints them.
 */

/** One stretch of a value as the laboratory sets it: plain, superscript or subscript. */
export type Run = { readonly t: string; readonly s?: "sup" | "sub" };

/** The significant digits a decimal token writes: its digits without the point or leading zeros. */
function significantDigits(token: string): number {
  return token.replace(".", "").replace(/^0+/, "").length;
}

/** A decimal token at four significant figures, written without an exponent. */
export function atFourFigures(token: string): string {
  const value = Number(token);
  if (!Number.isFinite(value) || value === 0 || significantDigits(token) <= 4) return token;
  const rounded = Number(value.toPrecision(4));
  const magnitude = Math.floor(Math.log10(Math.abs(rounded)));
  return rounded.toFixed(Math.max(0, 3 - magnitude));
}

/** A value's runs as a plate shows them: each long decimal in its plain runs at four figures. */
export function previewValue(runs: readonly Run[]): Run[] {
  return runs.map((run) =>
    run.s ? { ...run } : { ...run, t: run.t.replace(/\d+\.\d+/g, (token) => atFourFigures(token)) },
  );
}
