import type { Metadata } from "next";
import { DriftDiffusionLab } from "../../../components/lab/DriftDiffusionLab.tsx";
import { LabFormula, LabInlineFormula } from "../../../components/lab/LabFormula.tsx";
import { LabInlineTerms } from "../../../components/lab/LabInlineTerms.tsx";
import { validateBm04Parameters } from "../../../experiments/bm04/parameters.ts";
import example from "../../../generated/bm04-example.json";
import { NotModeledLine } from "../NotModeledLine.tsx";

export const metadata: Metadata = {
  title: "Drift-diffusion balance and the Stokes-Einstein relation",
  description:
    "How can a drag force and equilibrium determine how fast particles diffuse, and why does the magnitude of the force drop out of the resulting diffusion coefficient?",
};

export default function DriftDiffusionLabPage() {
  const checked = validateBm04Parameters(example.parameters);
  if (checked.kind !== "accepted") {
    throw new Error("The prepared drift-diffusion parameters are invalid.");
  }
  return (
    <>
      <LabInlineTerms lab="bm-04" />
      <header className="page-intro">
        <p className="eyebrow">Brownian motion · Route A §3</p>
        <h1>
          <span>Balancing directional drag</span> <span>against random spreading.</span>
        </h1>
        <p className="lead">
          How can a drag force and equilibrium determine how fast particles diffuse, and why does
          the magnitude of the force drop out of the resulting diffusion coefficient?
        </p>
      </header>

      <DriftDiffusionLab example={{ ...example, parameters: checked.data }} />
      <NotModeledLine instrumentId="bm-04" />
      <nav className="lab-onward" aria-label="From here">
        <h2>From here</h2>
        <ul>
          <li>
            <a href="/discover/brownian-motion/">Start with the discovery journey</a>
          </li>
          <li>
            <a href="/papers/brownian-motion/view/german/#s3">
              Read Section 3 of Einstein’s 1905 paper, in the German original
            </a>
          </li>
        </ul>
      </nav>

      <section className="reading" id="theory">
        <h2>The physical argument in Section 3</h2>
        <p>
          Section 3 is where Route A reaches the diffusion coefficient. Einstein’s derivation
          operates in two complementary stages:
        </p>
        <ol>
          <li>
            <strong>Thermodynamic Force Balance:</strong> A virtual displacement shows that in
            equilibrium, a persistent external force <var>K</var> acting on suspended particles must
            be balanced by an opposing osmotic pressure gradient:
            <LabInlineFormula
              lab="bm-04"
              latex={String.raw`K\,\nu = \frac{RT}{N}\frac{\partial\nu}{\partial x}`}
            />
            Here <var>ν</var> is the number density of suspended particles, <var>R</var> is the
            ideal gas constant, <var>T</var> is absolute temperature, and <var>N</var> is Avogadro’s
            number.
          </li>
          <li>
            <strong>Dynamic Flux Equilibrium:</strong> Under the force <var>K</var>, each particle
            acquires a steady Stokes drift velocity <var>v = K / (6π k P)</var> (where <var>k</var>{" "}
            is fluid viscosity and <var>P</var> is particle radius). Meanwhile, random thermal
            diffusion produces a counter-flux <var>-D ∂ν/∂x</var>. Equating the two fluxes gives:
            <LabFormula
              lab="bm-04"
              latex={String.raw`J_{\text{net}} = \nu\,\frac{K}{6\pi k P} - D\frac{\partial\nu}{\partial x} = 0`}
            />
          </li>
        </ol>

        <p>
          Substituting the spatial concentration gradient from the first stage into the second stage
          yields Einstein’s celebrated relation for the diffusion coefficient:
        </p>
        <LabFormula
          lab="bm-04"
          latex={String.raw`D = \frac{RT}{N}\frac{1}{6\pi k P} = \mu k_B T`}
        />

        <h3>Why the applied force drops out</h3>
        <p>
          The external force <var>K</var> is merely a theoretical probe: a stronger force creates a
          steeper concentration gradient in exact proportion to the faster drift speed it induces.
          When the two descriptions are equated, the force cancels out completely.
        </p>

        <h3>The Nägeli kicks-off branch (1879)</h3>
        <p>
          In 1879, the botanist Carl Nägeli argued that no single molecular impact could impart
          measurable momentum to a microscopic particle, concluding that thermal molecular agitation
          cannot explain Brownian movement.
        </p>
        <p>
          The <em>kicks-off branch</em> (<var>m = 0</var>) demonstrates what happens in a world
          without thermal fluctuations: any weak force causes particles to drift irreversibly into
          the wall and pile up, while an existing concentration gradient can never relax.
        </p>
        <p>
          Nägeli’s premise regarding individual molecular impacts was physically correct; his
          conclusion failed because he overlooked the statistical imbalance of billions of random
          molecular collisions occurring every microsecond.
        </p>
      </section>
    </>
  );
}
