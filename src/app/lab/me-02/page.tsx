import type { Metadata } from "next";
import { Formula } from "../../../components/edition/Formula.tsx";
import { CoefficientComparison } from "../../../components/lab/CoefficientLab.tsx";
import { validateMe02Parameters } from "../../../experiments/me02/parameters.ts";
import example from "../../../generated/me02-example.json";
import massEnergyEquations from "../../../generated/mass-energy-equations.json";
import type { CompiledEquation } from "../../../equations/viewTypes.ts";

export const metadata: Metadata = { title: "Inertia from the small-speed coefficient" };

export default function CoefficientPage() {
  const checked = validateMe02Parameters(example.parameters);
  if (checked.kind !== "accepted") {
    throw new Error("The prepared mass-energy coefficient parameters are invalid.");
  }
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Mass and energy · The small-speed coefficient</p>
        <h1>
          A smaller energy of motion
          <br />
          at the same speed.
        </h1>
        <p className="lead">
          Under the unchanged-offset premise, emitting energy L reduces energy of motion by L(γ − 1). What does that
          drop tell you about the body&apos;s inertia, and why does the conclusion come from low
          speeds rather than from a slogan assigned in advance?
        </p>
        <p>
          <a href="/papers/mass-energy/#arg-me-small-speed">Read the coefficient argument (explanatory preview) →</a>
        </p>
      </header>
      <CoefficientComparison example={{ ...example, parameters: checked.data }}
        equations={massEnergyEquations.equations as readonly CompiledEquation[]} />
      <section className="reading" id="coefficient-argument">
        <p className="eyebrow">Open the coefficient argument</p>
        <h2>The exact drop, then the Newtonian coefficient</h2>
        <p>
          The two-ledger subtraction (ME-01) gives the change in energy of motion at speed v. This
          laboratory never assigns the body a rest energy Mc² or γMc² to begin with. The printed
          glyph Einstein used for the Lorentz factor in paper 4 is UNKNOWN until the facsimile is
          pinned; the formulas below use the modern γ.
        </p>
        <Formula
          latex={String.raw`K_0-K_1=L(\gamma-1)=L\frac{\gamma^2\beta^2}{\gamma+1},\qquad \beta=\frac{v}{c}`}
        />
        <p>
          At small speed the Newtonian energy of motion is ½mv². Matching the second-order term
          identifies a mass change L/c². The quadratic estimate is that second-order piece alone.
        </p>
        <Formula
          latex={String.raw`\tfrac12 L\beta^2\qquad\text{(quadratic)}\qquad\lim_{v\to 0}\frac{2L(\gamma-1)}{v^2}=\frac{L}{c^2}`}
        />
        <h2>The finite-speed proxy is not the limit</h2>
        <p>
          At a finite speed the ratio 2L(γ − 1)/v² is a proxy for the coefficient, never labeled the
          exact mass loss. At 0.6c with L = 1 (normalized, c = 1) the exact drop is 0.25 L, the
          quadratic estimate is 0.18 L, and the proxy is 1.3888889 L/c². The analytic limit at
          vanishing speed remains 1 × L/c². The claim that the proxy equals the limit at every speed
          fails at 0.6c for that reason. The same numbers hold at −0.6c: every output is even in v.
        </p>
        <p>
          At v = 0 the proxy is not applicable, because it divides by v². The identified coefficient
          is then the analytic limit L/c², obtained without a 0/0 division.
        </p>
        <h2>Einstein&apos;s printed factor is a rounded V²</h2>
        <p>
          Paper 4 converts energy in erg with V² = 9 × 10²⁰. That printed factor is 0.1385 percent
          larger than the modern c². The two constant sets are never combined into one number. The
          laboratory shows both conversions of L = 9 × 10²⁰ erg as a labeled comparison, not as a
          percentage computed in the page.
        </p>
        <div className="actions">
          <a className="button" href="/papers/mass-energy/#arg-me-small-speed">
            Return to the small-speed argument →
          </a>
          <a href="/papers/mass-energy/#entry-mass-energy">Compare two energy accounts without algebra</a>
        </div>
      </section>
    </>
  );
}
