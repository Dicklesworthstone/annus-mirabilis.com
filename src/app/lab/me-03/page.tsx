import type { Metadata } from "next";
import { Formula } from "../../../components/edition/Formula.tsx";
import { BoundaryLedgerComparison } from "../../../components/lab/me03/BoundaryLedgerLab.tsx";
import { DEFAULT_PREPARED_EXAMPLE } from "../../../experiments/me03/session.ts";

export const metadata: Metadata = {
  title: "The system-boundary energy ledger (ME-03)",
};

export default function BoundaryLedgerPage() {
  const example = DEFAULT_PREPARED_EXAMPLE;

  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Mass–Energy · System Boundaries & Empirical Checks</p>
        <h1>
          System boundaries
          <br />
          and the energy ledger.
        </h1>
        <p className="lead">
          When energy leaves a body as radiation, which system loses mass, and which does not? Drag
          a thermodynamic boundary around the components and inspect what energy crosses it.
        </p>
        <p>
          <a href="/papers/mass-energy/#arg-me-scope">Read the explanatory preview and its scope</a>
        </p>
      </header>

      <BoundaryLedgerComparison example={example} />

      <section className="reading" id="system-boundary-reading">
        <p className="eyebrow">The physics of the boundary</p>
        <h2>Three thermodynamic boundaries</h2>
        <p>
          Einstein concludes that if a body gives off the energy <var>L</var> in the form of
          radiation, its mass diminishes by <var>L/V²</var> (or in modern notation <var>L/c²</var>):
        </p>
        <Formula latex={String.raw`\Delta m = -\frac{L}{c^2}`} />
        <p>
          The total energy of an isolated system is strictly conserved. If the boundary is drawn
          around the emitting body and the radiation together inside a sealed container, no energy
          escapes, and the total mass of the enclosure remains completely unchanged:
        </p>
        <Formula
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
        <Formula
          latex={String.raw`m^2 c^2 = P^\mu P_\mu = \left(\frac{E}{c}\right)^2 - \|\mathbf{p}\|^2`}
        />
        <p>
          While a single light pulse has <var>|p| = E/c</var> and is therefore massless (
          <var>m = 0</var>), two equal and opposite light pulses have total momentum{" "}
          <var>p = 0</var> and carry a nonzero system invariant mass:
        </p>
        <Formula latex={String.raw`m_{\text{two pulses}} = \frac{L}{c^2}`} />

        <div className="actions">
          <a className="button" href="/lab/me-01/">
            Open the two-ledger laboratory (ME-01)
          </a>
          <a href="/lab/me-02/">Open the small-speed coefficient laboratory (ME-02)</a>
        </div>
      </section>
    </>
  );
}
