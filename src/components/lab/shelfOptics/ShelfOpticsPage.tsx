import {
  SHELF_DEFINITIONS,
  SHELF_IDS,
  type ShelfId,
} from "../../../experiments/shelfOptics/definition.ts";
import { evaluateShelfOptics } from "../../../experiments/shelfOptics/evaluation.ts";
import { Formula } from "../../edition/Formula.tsx";
import { ShelfOpticsLab } from "./ShelfOpticsLab.tsx";
import "./shelfOptics.css";

/** Server-rendered calibration and mathematics; changing settings reuses the same owner. */
export function ShelfOpticsPage({ instrumentId }: { instrumentId: ShelfId }) {
  const definition = SHELF_DEFINITIONS[instrumentId];
  const example = evaluateShelfOptics(definition.defaults);
  return (
    <article data-edition-status="explanatory-preview">
      <header className="page-intro">
        <p className="eyebrow">Laboratory · Historical model comparison · Explanatory preview</p>
        <h1>{definition.title}</h1>
        <p className="lead">{definition.question}</p>
      </header>
      <ShelfOpticsLab
        key={instrumentId}
        example={example}
        laterEquation={<Formula latex={String.raw`u_{\mathrm{rel}}=\frac{c/n+v}{1+v/(nc)}`} />}
      />
      {/* After the lab rather than above it: the page opens on the comparison, and this is the
          first thing under it. It says what the numbers are before anything interprets them. */}
      <p className="notice">
        These are host reference calculations with modern SI calibration and illustrative settings.
        They are not historical measurements, a historical dataset, or publication of the strict
        1904 shelf. No FrankenSim WASM calculation is claimed.
      </p>
      <section className="reading" aria-labelledby="shelf-model-scope">
        <h2 id="shelf-model-scope">What is being calculated?</h2>
        {instrumentId === "shelf-michelson-morley" && (
          <>
            <p>
              The apparatus has equal one-way arm lengths before any hypothesized contraction. The
              wind is aligned with one arm, and the displayed fringe prediction is the change after
              a 90° rotation. Unequal arms, angular sweeps, source coherence and an empirical upper
              bound are not modeled here.
            </p>
            <Formula
              latex={String.raw`t_{\parallel}=\frac{2L}{c(1-\beta^2)},\qquad t_{\perp}=\frac{2L}{c\sqrt{1-\beta^2}}`}
            />
            <Formula
              latex={String.raw`\Delta N_{90^\circ}=\frac{2c}{\lambda}(t_{\parallel}-t_{\perp})\simeq\frac{2L}{\lambda}\beta^2`}
            />
            <p>
              These formulas describe the uncontracted case. For the contracted case the
              longitudinal arm is shortened by √(1 − β²), which equalizes the two round-trip times
              for equal rest lengths. The numerical owner evaluates the small difference in a
              cancellation-resistant form.
            </p>
            <p>
              Try doubling the arm length, then doubling the wavelength, then reversing the wind.
              Finally choose a much larger speed ratio and inspect where the leading β²
              approximation departs from the exact model expression. Large ratios are mathematical
              stress tests, not claims about terrestrial wind speeds.
            </p>
          </>
        )}
        {instrumentId === "shelf-fizeau" && (
          <>
            <p>
              The path is the total distance spent in moving water by each beam. For a layout in
              which each beam traverses two tubes of length ℓ, enter 2ℓ, not ℓ. Forward and backward
              name fixed paths; negative water speed reverses the flow relative to those paths.
            </p>
            <Formula
              latex={String.raw`u_\pm=\frac{c}{n}\pm fv,\qquad f\in\left\{0,1,1-\frac{1}{n^2}\right\}`}
            />
            <Formula
              latex={String.raw`\Delta N=\frac{cL_w}{\lambda}\left(\frac{1}{c/n-fv}-\frac{1}{c/n+fv}\right)`}
            />
            <p>
              This expression is for a one-direction comparison. Comparing opposite flow directions
              doubles it. The admitted range keeps both path speeds positive. The assumed index is
              not a condition-specific calibration of real water; dispersion, detailed apparatus
              geometry, losses and uncertainty are not modeled.
            </p>
            <p>
              Set the flow to zero, reverse its sign, and switch the reversal protocol. Change n to
              1 and inspect the Fresnel term. The later velocity-addition comparison is opt-in and
              is not used to justify the earlier hypotheses.
            </p>
          </>
        )}
        {instrumentId === "shelf-maxwell-galilean" && (
          <>
            <p>
              The diagnostic is the scalar forward-travelling wave cos(k(x − ct)) and the vacuum
              operator ∂²/∂x² − c⁻²∂²/∂t². The six-component Maxwell–Hertz field equations are not
              modeled: this residual belongs to the scalar wave alone. The largest absolute residual
              is the analytic amplitude over phase, not a sampled numerical maximum.
            </p>
            <Formula
              latex={String.raw`x'=x-vt,\quad t'=t\quad\Longrightarrow\quad (1-\beta^2)\partial_{x'}^2+\frac{2v}{c^2}\partial_{x'}\partial_{t'}-\frac{1}{c^2}\partial_{t'}^2`}
            />
            <Formula
              latex={String.raw`\frac{\max|\square'\phi|}{k^2}=|\beta(2-\beta)|\quad\text{(Galilean)},\qquad 0\quad\text{(Lorentz)}`}
            />
            <p>
              Hold the frame speed fixed and double k. The absolute residual changes while the
              normalized one does not. Then set the frame speed to zero. A preserved wave operator
              alone does not fix the physical meaning or normalization of all transformed fields.
            </p>
            <p>
              <a href="/lab/sr-07/">Continue to the Maxwell–Hertz field-equation laboratory</a>
              {" · "}
              <a href="/lab/sr-04/">Construct the coordinate map from its constraints</a>
            </p>
          </>
        )}
      </section>
      <section className="reading" aria-labelledby="shelf-evidence-status">
        <h2 id="shelf-evidence-status">Prediction is not a measurement</h2>
        <p>
          No observed points, digitized fringe shifts or experimental confidence bounds have been
          added to these plots. A source-specific dataset, with its geometry, wavelength, protocol
          and uncertainty, is still needed before making a numerical comparison with a historical
          experiment.
        </p>
        <p>
          The reference implementation is <code>src/physics/reference/shelfOptics.ts</code>. Its
          functions own the arm times, fringe shifts, drag speeds and wave residuals; the interface
          only projects their results. Numerical precision in a table does not imply measurement
          accuracy.
        </p>
        <p>
          <a href="https://github.com/Dicklesworthstone/annus-mirabilis.com/blob/main/src/physics/reference/shelfOptics.ts">
            Inspect the reference calculations
          </a>
        </p>
      </section>
      {/* The comparison's source context, in a sentence rather than the actions row below: print
          hides .actions, and this was the page's only link to where the comparison belongs. */}
      <p>
        This comparison belongs to the{" "}
        <a href="/discover/special-relativity/">special-relativity discovery route</a>.
      </p>
      <nav className="actions" aria-label="Related optical comparisons">
        {SHELF_IDS.filter((id) => id !== instrumentId).map((id) => (
          <a key={id} href={`/lab/${id}/`}>
            {SHELF_DEFINITIONS[id].title}
          </a>
        ))}
        <a href="/instruments/">All instruments</a>
      </nav>
    </article>
  );
}
