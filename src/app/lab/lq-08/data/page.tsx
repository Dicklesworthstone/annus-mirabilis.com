import type { Metadata } from "next";
import { constantValue, getConstantSet } from "../../../../physics/reference/constants.ts";
import { PhotoelectricDataWorkbench } from "../../../../reasoning/photoelectricData/PhotoelectricDataWorkbench.tsx";
import { acceptAnalysisDraft, exampleDraft } from "../../../../reasoning/photoelectricData/session.ts";

export const metadata: Metadata = {
  title: "Infer from a photoelectric stopping-potential record",
  description: "Fit your own frequency and stopping-potential CSV, inspect residuals, and separate the measured slope from voltage-offset and work-function assumptions.",
  alternates: { canonical: "/lab/lq-08/data/" },
};
export default function PhotoelectricDataPage() {
  // Numerical acceptance is not historical or editorial review.
  if ((process.env.AM_RELEASE_PROFILE ?? "scaffold") !== "scaffold") return <section className="reading"><h1>Photoelectric data analysis in preparation</h1><p>This release profile does not publish the explanatory draft. <a href="/papers/light-quanta/">Return to the light-quanta paper</a>.</p></section>;
  const constants = getConstantSet("modern-si-2019");
  const reference = {
    constantSetId: constants.id,
    elementaryCharge: constantValue(constants, "elementaryCharge").value,
    planckConstant: constantValue(constants, "planckConstant").value,
    speedOfLight: constantValue(constants, "speedOfLight").value,
  };
  const initial = acceptAnalysisDraft(exampleDraft(), reference);
  if (initial.kind !== "accepted") throw new Error(`Invalid constructed photoelectric example: ${initial.message}`);
  return <>
    <header className="page-intro">
      <p className="eyebrow">Light quanta · Local data analysis · Explanatory preview</p>
      <h1>What does your stopping-potential line actually identify?</h1>
      <p className="lead">A frequency sweep can constrain a slope without settling the surface escape work. Bring a record, inspect the residuals, then make the calibration assumption visible.</p>
      <p><a href="/lab/lq-08/">Return to the photoelectric apparatus</a>{" · "}<a href="/papers/light-quanta/#s8">Read the light-quanta argument, §8</a></p>
    </header>
    <PhotoelectricDataWorkbench reference={reference} example={initial.state} />
    <section className="reading">
      <h2>The line is empirical; the interpretation needs premises</h2>
      <p>The fitted relation is measured stopping voltage = slope × frequency + intercept. In the single-quantum model with one unchanged surface, the slope corresponds to h/e, while the intercept combines negative escape work per charge with the instrument’s common voltage offset.</p>
      <p>An unknown offset therefore leaves a family of escape works compatible with the same line. Entering an independently calibrated offset selects one member of that family. The reported physical threshold uses that calibration; it is not automatically the frequency where the uncorrected instrument voltage crosses zero.</p>
      <h2>Choose an error model, then examine its failures</h2>
      <p>Equal-weight fitting estimates a common voltage variance from residuals. Uncertainty-weighted fitting uses the supplied inverse variances and does not rescale them to make the fit appear consistent. Both treat frequencies as fixed, and observations as independent. Error bars are one standard uncertainty, not a claimed confidence interval.</p>
      <p>The threshold error is a first-order propagation of the slope, intercept and independent calibration uncertainty, including their covariance. It can become unreliable near zero slope; the workbench then leaves the ratio unresolved. A narrow frequency range also makes the intercept a long extrapolation.</p>
      <p>Only measured stopping endpoints from the same surface and protocol belong in one fit. A below-threshold non-detection is not a zero endpoint. Wavelength inputs must be vacuum wavelengths. Frequency errors, voltage-gain uncertainty, correlated drift, changing surface condition, contact-potential variation and non-linear response require a richer model. The tool does not silently remove those effects.</p>
      <p>A good-looking line is not proof of quantum transfer. Constructed examples exercise the inference code; they are not a substitute for independently sourced observations. No new historical dataset has been added here.</p>
      <p>Method reference: <a href="https://www.itl.nist.gov/div898/handbook/pmd/section4/pmd432.htm">NIST/SEMATECH, weighted least squares</a>{" · "}<a href="https://www.itl.nist.gov/div898/handbook/pmd/section4/pmd452.htm">Choosing inverse-variance weights and their limitations</a>.</p>
      <details><summary>Inspect the numerical implementation</summary>
        <p>The existing Millikan OLS function and this workflow share <code>src/physics/reference/inference/lineFit.ts</code>. Interpretation and covariance propagation are owned by <code>photoelectricData.ts</code>, not the plot. The modern reference constants are read from the edition’s constant-set registry and are never fitted to the CSV.</p>
        <p><a href="https://github.com/Dicklesworthstone/annus-mirabilis.com/blob/main/src/physics/reference/inference/photoelectricData.ts">Photoelectric inference source</a>{" · "}<a href="https://github.com/Dicklesworthstone/annus-mirabilis.com/blob/main/src/physics/reference/inference/lineFit.ts">Least-squares source</a></p>
      </details>
    </section>
  </>;
}
