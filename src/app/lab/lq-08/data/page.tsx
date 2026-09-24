import type { Metadata } from "next";
import { withScripts } from "../../../../components/lab/subscripts.tsx";
import { PHOTOELECTRIC_DATA_CAPTION } from "../../../../reasoning/photoelectricData/caption.ts";
import { PhotoelectricDataWorkbench } from "../../../../reasoning/photoelectricData/PhotoelectricDataWorkbench.tsx";
import {
  acceptedExampleAnalysis,
  modernPhotoelectricReference,
} from "../../../../reasoning/photoelectricData/session.ts";

export const metadata: Metadata = {
  title: "Infer from a photoelectric stopping-potential record",
  description:
    "Fit your own frequency and stopping-potential CSV, inspect residuals, and separate the measured slope from voltage-offset and work-function assumptions.",
  alternates: { canonical: "/lab/lq-08/data/" },
};
export default function PhotoelectricDataPage() {
  // Numerical acceptance is not historical or editorial review.
  if ((process.env.AM_RELEASE_PROFILE ?? "scaffold") !== "scaffold")
    return (
      <section className="reading">
        <h1>Photoelectric data analysis in preparation</h1>
        <p>
          This release profile does not publish the explanatory draft.{" "}
          <a href="/papers/light-quanta/">Return to the light-quanta paper</a>.
        </p>
      </section>
    );
  const reference = modernPhotoelectricReference();
  const initial = acceptedExampleAnalysis(reference);
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Light quanta · Your data · Preview</p>
        <h1>What does your stopping-potential line actually identify?</h1>
        <p className="lead">
          A frequency sweep can constrain a slope without settling the surface escape work. Bring a
          record, inspect the residuals, then make the calibration assumption visible.
        </p>
      </header>
      <PhotoelectricDataWorkbench reference={reference} example={initial} />
      <section className="lab-readings" aria-label="The fit in words">
        <p data-detail="0">{withScripts(PHOTOELECTRIC_DATA_CAPTION.r0)}</p>
        <p data-detail="1">{withScripts(PHOTOELECTRIC_DATA_CAPTION.r1)}</p>
        <p data-detail="2" hidden>
          {withScripts(PHOTOELECTRIC_DATA_CAPTION.r2)}
        </p>
        <p data-detail="3" hidden>
          {withScripts(PHOTOELECTRIC_DATA_CAPTION.r3)}
        </p>
      </section>
      <nav className="lab-onward" aria-label="From here">
        <h2>From here</h2>
        <ul>
          <li>
            <a href="/lab/lq-08/">Return to the photoelectric apparatus</a>
          </li>
          <li>
            <a href="/papers/light-quanta/#s8">Read the light-quanta argument, §8</a>
          </li>
        </ul>
      </nav>
      <section className="reading">
        <h2>The line is empirical; the interpretation needs premises</h2>
        <p>
          The fitted relation is measured stopping voltage = slope × frequency + intercept. In the
          single-quantum model with one unchanged surface, the slope corresponds to h/e, while the
          intercept combines negative escape work per charge with the instrument’s common voltage
          offset.
        </p>
        <p>
          An unknown offset therefore leaves a family of escape works compatible with the same line.
          Entering an independently calibrated offset selects one member of that family. The
          reported physical threshold uses that calibration; it is not automatically the frequency
          where the uncorrected instrument voltage crosses zero.
        </p>
        <h2>Choose an error model, then examine its failures</h2>
        <p>
          Equal-weight fitting estimates a common voltage variance from residuals.
          Uncertainty-weighted fitting uses the supplied inverse variances and does not rescale them
          to make the fit appear consistent. Both treat frequencies as fixed, and observations as
          independent. Error bars are one standard uncertainty, not a claimed confidence interval.
        </p>
        <p>
          The threshold error is a first-order propagation of the slope, intercept and independent
          calibration uncertainty, including their covariance. It can become unreliable near zero
          slope; the workbench then leaves the ratio unresolved. A narrow frequency range also makes
          the intercept a long extrapolation.
        </p>
        <p>
          Only measured stopping endpoints from the same surface and protocol belong in one fit. A
          below-threshold non-detection is not a zero endpoint. Wavelength inputs must be vacuum
          wavelengths. Frequency errors, voltage-gain uncertainty, correlated drift, changing
          surface condition, contact-potential variation and non-linear response require a richer
          model. The tool does not silently remove those effects.
        </p>
        <p>
          A good-looking line is not proof of quantum transfer. Constructed examples exercise the
          inference code; they are not a substitute for independently sourced observations. No new
          historical dataset has been added here.
        </p>
        <p>
          Method reference:{" "}
          <a href="https://www.itl.nist.gov/div898/handbook/pmd/section4/pmd432.htm">
            NIST/SEMATECH, weighted least squares
          </a>
          {" · "}
          <a href="https://www.itl.nist.gov/div898/handbook/pmd/section4/pmd452.htm">
            Choosing inverse-variance weights and their limitations
          </a>
          .
        </p>
        <details>
          <summary>Inspect the numerical implementation</summary>
          <p>
            LQ-08’s line fit and this workflow share{" "}
            <code>src/physics/reference/inference/lineFit.ts</code>. Interpretation and covariance
            propagation are owned by <code>photoelectricData.ts</code>, not the plot. The modern
            reference constants are read from the edition’s constant-set registry and are never
            fitted to the CSV.
          </p>
          <p>
            <a href="https://github.com/Dicklesworthstone/annus-mirabilis.com/blob/main/src/physics/reference/inference/photoelectricData.ts">
              Photoelectric inference source
            </a>
            {" · "}
            <a href="https://github.com/Dicklesworthstone/annus-mirabilis.com/blob/main/src/physics/reference/inference/lineFit.ts">
              Least-squares source
            </a>
          </p>
        </details>
      </section>
    </>
  );
}
