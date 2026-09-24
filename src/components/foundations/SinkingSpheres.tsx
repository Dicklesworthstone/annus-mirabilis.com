import { useId } from "react";
import { sci } from "../../foundations/configurations.ts";
import { SINKING, SINKING_ROWS } from "../../foundations/sinkingSpheres.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

/** Keep a number's "× 10⁻¹⁵" on the line its mantissa is on. */
const together = (s: string) => s.replace(/ × /g, " × ");

/**
 * The Stokes-drag lesson's construction: a sinking-sphere table. Every number is printed in
 * src/foundations/sinkingSpheres.ts and recomputed through the Stokes owner by its test.
 */
export function SinkingSpheres({ headingLevel = 3 }: { readonly headingLevel?: HeadingLevel }) {
  const headingId = useId(),
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);
  const smallest = SINKING_ROWS[0];
  const largest = SINKING_ROWS[SINKING_ROWS.length - 1];

  return (
    <section
      className="foundation-construction"
      aria-labelledby={headingId}
      data-foundation-construction="viscosity-stokes-drag"
    >
      <Title id={headingId} className="construction-title">
        Sinking spheres: drag against weight
      </Title>
      <p>
        A grain a little denser than water sinks at the speed where the drag holding it back equals
        its weight less the water's buoyancy. The excess weight grows with the cube of the radius
        and the drag at a given speed only with the radius, so the sinking speed grows with the
        square of the radius, v = 2Δρga²/(9η): ten times the radius, a hundred times as fast. Here
        the grains are {SINKING.grainDensity} kg/m³, 1.2 times as dense as water, in water at{" "}
        {SINKING.viscosity * 1000} mPa·s.
      </p>

      <table className="data-table">
        <caption>
          Grains of {SINKING.grainDensity} kg/m³ sinking through water. The 0.5 μm row is the
          lesson's sphere; times are rounded.
        </caption>
        <thead>
          <tr>
            <th scope="col">Radius, μm</th>
            <th scope="col">Drag at 1 μm/s, 10⁻¹⁵ N</th>
            <th scope="col">Sinks, μm/s</th>
            <th scope="col">Time to sink 1 mm</th>
          </tr>
        </thead>
        <tbody>
          {SINKING_ROWS.map((row) => (
            <tr key={row.radius}>
              <th scope="row">{row.radius}</th>
              <td>{Number((row.drag / 1e-15).toPrecision(3))}</td>
              <td>{row.speed}</td>
              <td>
                {row.time.value} {row.time.unit === "hours" ? "h" : "min"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p>
        Every row is far inside Stokes's regime: the water's inertia is between{" "}
        {together(sci(smallest?.inertiaRatio ?? 0, 1))} and{" "}
        {together(sci(largest?.inertiaRatio ?? 0, 1))} of its viscous resistance. The
        half-micrometre sphere takes hours to sink a millimetre. In one second, by the estimate in
        §5 of the Brownian paper, it wanders about 0.8 μm, several times as far as it sinks. That is
        why such spheres stay suspended long enough to watch.
      </p>

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          The drag on a sphere at a given speed doubles when the radius doubles, but the weight that
          makes it sink grows eightfold, so larger grains sink much faster. A grain of 0.25 μm
          radius takes about 10 hours to sink a millimetre through water; one of 5 μm takes about a
          minute and a half. The half-micrometre sphere of the lesson feels a drag of 9.42 × 10⁻¹⁵
          newtons at 1 μm/s and sinks at about 0.1 μm each second.
        </p>
      </div>
    </section>
  );
}
