import {
  DISSERTATION_PRINTED,
  DISSERTATION_RECONSTRUCTION,
  DISSERTATION_SOURCES,
} from "./dissertationHistorical.ts";

const shown = (value: number) => Number(value.toPrecision(5)).toString();
const count = (value: number) => `${shown(value / 1e23)} × 10²³`;
const radius = (value: number) => `${shown(value * 1e9)} nm`;

/** Values come from the numerical owner; this server surface only formats and compares them. */
export function DissertationComparison() {
  const { main, supplement, correction } = DISSERTATION_PRINTED;
  const reconstructed = DISSERTATION_RECONSTRUCTION;
  return (
    <section
      aria-labelledby="avogadro-dissertation-comparison-title"
      data-dissertation-comparison="printed-products-and-coefficient-correction"
    >
      <h5 id="avogadro-dissertation-comparison-title">Keep the three stages separate</h5>
      <table>
        <caption>Three stages, with the observations and the coefficient kept distinct</caption>
        <thead>
          <tr>
            <th scope="col">Stage</th>
            <th scope="col">Source and reconstruction</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">
              Main text
              <br />
              Written in 1905, printed in 1906
            </th>
            <td>
              <p>
                Printed: N = {count(main.molecularNumber)} mol⁻¹; P = {radius(main.radius)}.
              </p>
              <p>
                From the two printed products: N ≈{" "}
                {count(reconstructed.main.molecularNumber.value)} mol⁻¹; P ≈{" "}
                {radius(reconstructed.main.radius.value)}. The rounding difference remains visible.
              </p>
              <a href={DISSERTATION_SOURCES.dissertation.mainHref}>Main calculation, p. 305</a>
            </td>
          </tr>
          <tr>
            <th scope="row">January 1906 supplement</th>
            <td>
              <p>
                Printed: N = {count(supplement.molecularNumber)} mol⁻¹; P ={" "}
                {radius(supplement.radius)}.
              </p>
              <p>
                These are reported outputs from the changed observations. The source prints the
                radius as 0.78 × 10⁻⁶ mm; 0.78 nm is the same length.
              </p>
              <a href={DISSERTATION_SOURCES.dissertation.supplementHref}>
                Supplement results, p. 306
              </a>
            </td>
          </tr>
          <tr>
            <th scope="row">1911 correction</th>
            <td>
              <p>Printed: N = {count(correction.molecularNumber)} mol⁻¹.</p>
              <p>
                Correcting the supplement's coefficient gives N ≈{" "}
                {count(reconstructed.correctedSupplement.molecularNumber.value)} mol⁻¹ and P ≈{" "}
                {radius(reconstructed.correctedSupplement.radius.value)}. The corrected radius is
                derived here; the correction note does not print it.
              </p>
              <a href={DISSERTATION_SOURCES.correction.href}>Correction, p. 592</a>
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        Correcting the original printed products instead gives N ≈{" "}
        {count(reconstructed.correctedMain.molecularNumber.value)} mol⁻¹. That value differs from
        the 1911 result because the supplement had already changed the observations. None of these
        rounded historical values supplies a confidence interval.
      </p>
    </section>
  );
}
