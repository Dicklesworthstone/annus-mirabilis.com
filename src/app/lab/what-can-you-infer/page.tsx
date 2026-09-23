import type { Metadata } from "next";
import generated from "../../../generated/inference-workbench.json";
import { parseInferenceEvidence } from "../../../reasoning/infer/evidence.ts";
import { FamilyWorkbench } from "../../../reasoning/infer/FamilyWorkbench.tsx";
import "../../../components/lab/showTheCode.css";

export const metadata: Metadata = {
  title: "What can you infer? Keep the data, add independent information",
  description:
    "Compare compatible Brownian parameter families, and distinguish additional information from additional assumptions. Synthetic worked examples, not historical observations.",
};
export default function InferenceWorkbenchPage() {
  const examples = generated.examples.map((example) => ({
    ideal: parseInferenceEvidence(example.ideal),
    camera: parseInferenceEvidence(example.camera),
    sourceDigest: generated.sourceDigest,
  }));
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Reasoning laboratory · Brownian motion</p>
        <h1>
          Keep the data.
          <br />
          Change what you know.
        </h1>
        <p className="lead">
          A curve can fit more than one explanation. Keep the observations fixed, inspect the
          compatible parameters, then ask which additional information separates them.
        </p>
        <p>
          These are two built-in synthetic datasets: ideal displacements and camera observations.
          This workbench does not import your current laboratory state. Changing an information
          choice neither resamples the observations nor changes the physical model.
        </p>
      </header>
      {examples.map((example) => (
        <FamilyWorkbench key={example.ideal.observationDigest} example={example} />
      ))}
      {examples.length === 0 && (
        <p className="notice">
          The reviewed inference cases are in preparation. This publication profile excludes the
          instructional drafts.
        </p>
      )}
      {/* The onward links sit after the workbench, in the family's "From here" list; in the intro
          they stacked into three rows above a phone's first result. */}
      <nav className="lab-onward" aria-label="From here">
        <h2>From here</h2>
        <ul>
          <li>
            <a href="/lab/bm-07/">Ideal inference laboratory</a>
          </li>
          <li>
            <a href="/lab/bm-08/">Camera laboratory</a>
          </li>
          <li>
            <a href="/papers/brownian-motion/#arg-bm-inference">Return to the argument</a>
          </li>
        </ul>
      </nav>
      <section className="reading">
        <h2>What the calculation does and does not establish</h2>
        <p>
          The first case assumes independent Gaussian increments and known zero drift. Its
          conservative molecular-number interval combines diffusion uncertainty with a separately
          declared radius interval. Timing, spatial calibration, gas constant, temperature and
          viscosity are treated as exact here.
        </p>
        <p>
          The camera case assumes equally spaced positions, known uniform exposure, known drift, and
          independent zero-mean localization errors with one fixed variance. Its two-moment
          estimates are not uncertainty intervals, and a negative solution is not quietly repaired.
        </p>
        <p>
          The camera model is a later measurement aid, not Einstein’s derivation. Synthetic recovery
          tests the inference machinery; it is not observational evidence for a real suspension.
        </p>
        <p>
          <a href="https://doi.org/10.1103/PhysRevE.82.011917">
            Berglund (2010): camera-based single-particle tracking
          </a>
          {" · "}
          <a href="https://doi.org/10.1103/PhysRevE.89.022726">
            Vestergaard, Blainey and Flyvbjerg (2014): covariance-based diffusion estimation
          </a>
        </p>
        <details>
          <summary>Inspect the inference calculation source used by this build</summary>
          <p className="digest">
            <code>{generated.sourceDigest}</code>
          </p>
          {generated.sourceCode.map((source) => (
            <section key={source.path}>
              <h3>{source.path}</h3>
              <p className="digest">
                <code>{source.hash}</code>
              </p>
              {/* A source line does not wrap, so the listing scrolls inside a named region a
                  keyboard can reach, not a bare scrolling <pre> (CLASS 2). */}
              <section
                className="show-the-code-scroll"
                aria-label={`${source.path} source`}
                // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable
                tabIndex={0}
              >
                <pre>
                  <code>{source.text}</code>
                </pre>
              </section>
            </section>
          ))}
        </details>
      </section>
    </>
  );
}
