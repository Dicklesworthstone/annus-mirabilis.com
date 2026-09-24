import { useId } from "react";
import { OSMOTIC_ROWS, OSMOTIC_TEMPERATURE } from "../../foundations/osmoticRows.ts";
import { formatScientificSuperscript, toSuperscriptDigits } from "../../i18n/numberLocale.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

/** Keep a number's "× 10⁻⁶" on the line its mantissa is on. */
const together = (s: string) => s.replace(/ × /g, " × ");

/** Always in powers of ten, and a bare power where the mantissa is 1. Every value here is positive. */
function powerOfTen(value: number, figures: number): string {
  const [mantissa, exponent] = value.toExponential(figures - 1).split("e") as [string, string];
  const exp = Number(exponent);
  if (Number(mantissa) === 1) return `10${toSuperscriptDigits(exp)}`;
  return together(formatScientificSuperscript(mantissa, exp));
}

/**
 * The osmotic-pressure lesson's construction: a selective-partition table, and the osmotic
 * partition laboratory (BM-02) by link. BM-02 has no manifest or admitted embed yet, so it is
 * linked, never embedded or reimplemented. Every number is printed in
 * src/foundations/osmoticRows.ts and recomputed through the owner by its test.
 */
export function OsmoticTable({ headingLevel = 3 }: { readonly headingLevel?: HeadingLevel }) {
  const headingId = useId(),
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);

  return (
    <section
      className="foundation-construction"
      aria-labelledby={headingId}
      data-foundation-construction="free-energy-osmotic-pressure"
    >
      <Title id={headingId} className="construction-title">
        Behind the partition: same count, same push
      </Title>
      <p>
        A wall that lets the liquid through but not the particles feels a pressure from them, p = νk
        <sub>B</sub>T, while they are dilute. Only the number per cubic metre and the temperature
        enter, so a grain pushes exactly as much as a sugar molecule. The table is at{" "}
        {OSMOTIC_TEMPERATURE} K.
      </p>

      <table className="data-table">
        <caption>
          What is behind the wall and how many per m³, the share of the volume they fill, and the
          pressure
        </caption>
        <thead>
          <tr>
            <th scope="col">Behind the wall</th>
            <th scope="col">Share filled</th>
            <th scope="col">Pressure, Pa</th>
          </tr>
        </thead>
        <tbody>
          {OSMOTIC_ROWS.map((row) => (
            <tr key={row.what}>
              <th scope="row">
                {row.what}: {powerOfTen(row.perCubicMetre, 3)} per m³
              </th>
              <td>
                {row.share === null
                  ? "dilute"
                  : row.share >= 0.1
                    ? row.share
                    : powerOfTen(row.share, 1)}
              </td>
              <td>
                {row.pressure === null
                  ? "not given: too crowded for the dilute law"
                  : powerOfTen(row.pressure, 2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p>
        The two grain sizes at a million per cubic millimetre push equally, although one is a
        thousand times the volume of the other. The last row is refused rather than computed: grains
        filling half the volume press on one another, and p = νk<sub>B</sub>T holds only when they
        do not. The <a href="/lab/bm-02/">osmotic partition laboratory</a> lets you change the
        count, the volume and the radius and see which of them the pressure depends on.
      </p>

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          At 293 kelvin, sugar dissolved at 0.1 gram-molecule per litre pushes on a partition with
          about 2.4 × 10⁵ pascals. A million grains per cubic millimetre push with about 4.0 × 10⁻⁶
          pascals, whether their radius is 0.5 or 0.05 micrometres: the pressure counts particles
          and does not weigh or measure them. At a billion grains of 0.5 micrometres per cubic
          millimetre they would fill half the volume, and the dilute law no longer applies.
        </p>
      </div>
    </section>
  );
}
