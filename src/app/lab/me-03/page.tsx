import type { Metadata } from "next";
import { LabFormula } from "../../../components/lab/LabFormula.tsx";
import { LabInlineTerms } from "../../../components/lab/LabInlineTerms.tsx";
import { BoundaryLedgerComparison } from "../../../components/lab/me03/BoundaryLedgerLab.tsx";
import { DEFAULT_PREPARED_EXAMPLE } from "../../../experiments/me03/session.ts";
import labDigests from "../../../generated/lab-source-digests.json";

export const metadata: Metadata = {
  title: "The system-boundary energy ledger",
  description:
    "When energy leaves a body as radiation, which system loses mass, and which does not?",
};

export default function BoundaryLedgerPage() {
  // The example names its host source by digest (scripts/generate-lab-digests.mjs).
  const example = { ...DEFAULT_PREPARED_EXAMPLE, sourceDigest: labDigests["me-03"] };

  return (
    <>
      <LabInlineTerms lab="me-03" />
      <header className="page-intro">
        <p className="eyebrow">Mass–Energy · System boundaries & empirical checks</p>
        <h1>
          <span>System boundaries</span> <span>and the energy ledger.</span>
        </h1>
        <p className="lead">
          When energy leaves a body as radiation, which system loses mass, and which does not? Drag
          a thermodynamic boundary around the components and inspect what energy crosses it.
        </p>
      </header>

      <BoundaryLedgerComparison example={example} />
      <nav className="lab-onward" aria-label="From here">
        <h2>From here</h2>
        <ul>
          <li>
            <a href="/papers/mass-energy/#arg-me-scope">
              Read the explanatory preview and its scope
            </a>
          </li>
        </ul>
      </nav>

      <section className="reading" id="system-boundary-reading">
        <p className="eyebrow">The physics of the boundary</p>
        <h2>Three thermodynamic boundaries</h2>
        <p>
          Einstein concludes that if a body gives off the energy <var>L</var> in the form of
          radiation, its mass diminishes by <var>L/V²</var> (or in modern notation <var>L/c²</var>):
        </p>
        <LabFormula lab="me-03" latex={String.raw`\Delta m = -\frac{L}{c^2}`} />
        <p>
          The total energy of an isolated system is strictly conserved. If the boundary is drawn
          around the emitting body and the radiation together inside a sealed container, no energy
          escapes, and the total mass of the enclosure remains completely unchanged:
        </p>
        <LabFormula
          lab="me-03"
          latex={String.raw`\Delta E_{\text{isolated}} = 0 \implies \Delta m_{\text{isolated}} = 0`}
        />

        <h2>Closed systems versus isolated systems</h2>
        <p>
          A system is <em>closed</em> if no matter crosses its boundary. It is <em>isolated</em>{" "}
          only if neither matter nor energy crosses its boundary. A radioactive radium salt sealed
          in an ampoule exchanges heat with its surroundings without losing matter; its mass
          decreases only as that heat leaves the container.
        </p>

        <h2>Modern four-momentum invariant mass</h2>
        <p>
          In modern relativistic mechanics, the invariant mass <var>m</var> of any system of
          particles or photons is the Lorentz norm of its total four-momentum{" "}
          <var>P^μ = (E/c, p)</var>:
        </p>
        <LabFormula
          lab="me-03"
          latex={String.raw`m^2 c^2 = P^\mu P_\mu = \left(\frac{E}{c}\right)^2 - \|\mathbf{p}\|^2`}
        />
        <p>
          While a single light pulse has <var>|p| = E/c</var> and is therefore massless (
          <var>m = 0</var>), two equal and opposite light pulses have total momentum{" "}
          <var>p = 0</var> and carry a nonzero system invariant mass:
        </p>
        <LabFormula lab="me-03" latex={String.raw`m_{\text{two pulses}} = \frac{L}{c^2}`} />

        <div className="actions">
          <a className="button" href="/lab/me-01/">
            Open the two-ledger laboratory
          </a>
          <a href="/lab/me-02/">Open the small-speed coefficient laboratory</a>
        </div>
      </section>
    </>
  );
}
