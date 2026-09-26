import type { Metadata } from "next";
import { TwoLedgersComparison } from "../../../../components/lab/me01/TwoLedgersLab.tsx";
import { JourneyFormula, journeyScope } from "../../../../discovery/JourneyFormula.tsx";
import { MassEnergyArgumentWorkbench } from "../../../../discovery/MassEnergyArgumentWorkbench.tsx";
import {
  ARGUMENT_STEPS,
  argumentStep,
  WORKED_ARGUMENT,
} from "../../../../discovery/massEnergyArgument.ts";
import { DEFAULT_PREPARED_EXAMPLE } from "../../../../experiments/me01/session.ts";
import labDigests from "../../../../generated/lab-source-digests.json";
import "../../../../discovery/investigationPage.css";
import "./argument.css";
import { StepDoor, StepDoors } from "../../../../discovery/StepDoor.tsx";

export const metadata: Metadata = {
  title: "Build the mass–energy argument",
  description:
    "Assemble the two-ledger derivation, keep its premises visible, and distinguish a mass–energy derivation from a circular consistency check.",
  robots: { index: false },
};

/** An explanatory investigation, not a publication of the reviewed Journey IV
 * or its historical shelf. The edition's existing publication gates are unchanged.
 */
export default function MassEnergyArgumentPage() {
  const equations = Object.fromEntries(
    ARGUMENT_STEPS.map((card) => [
      card.id,
      <JourneyFormula
        key={card.id}
        latex={card.latex}
        tabIndex={0}
        scope={journeyScope("mass-energy", "s0", card.id, "investigate")}
      />,
    ]),
  );
  return (
    <article
      className="mass-energy-investigation investigation-page"
      data-discovery-workbench="mass-energy"
      data-edition-status="explanatory-preview"
    >
      <header className="page-intro">
        <p className="eyebrow">Mass–energy · An explanatory investigation</p>
        <h1>Can you reach the conclusion without assuming it?</h1>
        <p className="lead">
          A body emits equal flashes in opposite directions and does not recoil. Two observers
          assign different energies to those flashes. Build the argument that connects their
          accounts to a change in the body’s inertia, keeping every extra premise visible.
        </p>
        <p className="notice">
          A route you could take: one argument that is enough to reach the result, not an account of
          Einstein’s private thinking. The symbols are modern: c, β = v/c and γ. The September paper
          writes V for the speed of light and the square root out in full.
        </p>
        <nav className="actions" aria-label="Investigation sections">
          <a href="#argument-workbench">Assemble the argument</a>
          <a href="#worked-argument">Read a worked route</a>
          <a href="#test-the-accounts">Test the two accounts</a>
        </nav>
      </header>

      <section className="reading" aria-labelledby="mass-energy-premises">
        <h2 id="mass-energy-premises">What is being admitted?</h2>
        <p>
          Energy is conserved in each inertial frame. The symmetric emission keeps the body’s speed
          unchanged. A light-energy transformation is imported from §8 of the special-relativity
          paper; it is not smuggled into a supposed 1904 starting point. No value is assigned to the
          body’s absolute internal energy.
        </p>
        <p>
          Use subscripts 0 and 1 for before and after emission. E is body energy in the rest frame,
          H is body energy in the moving frame, K is kinetic energy, and L is the total light energy
          emitted in the rest frame. C denotes the additive offset in the stated identification H −
          E = K + C. Whether that offset changes is a premise to inspect, not an algebraic detail.
        </p>
        <StepDoors>
          <StepDoor href="/lab/sr-10/">
            Inspect the imported finite-light-complex transformation
          </StepDoor>
          <StepDoor href="/lab/me-01/#two-ledgers-argument">
            Read the two-ledger equations and their source context
          </StepDoor>
        </StepDoors>
      </section>

      <MassEnergyArgumentWorkbench equations={equations} />

      <section className="reading" id="worked-argument" aria-labelledby="worked-argument-title">
        <h2 id="worked-argument-title">A worked route, available without assembling cards</h2>
        <p>
          The first useful subtraction determines a difference of frame-energy differences. The
          unchanged-offset premise then makes it a kinetic-energy decrease. The small-speed
          coefficient, not a finite-speed division, identifies the inertia lost.
        </p>
        <details className="argument-worked-route" data-essential-for-print="true">
          <summary>Show every step and its reason</summary>
          <ol>
            {WORKED_ARGUMENT.map((id) => {
              const step = argumentStep(id);
              return (
                <li key={id}>
                  <h3>{step.title}</h3>
                  <JourneyFormula
                    latex={step.latex}
                    tabIndex={0}
                    scope={journeyScope("mass-energy", "s0", id, "investigate")}
                  />
                  <p>{step.explanation}</p>
                </li>
              );
            })}
          </ol>
        </details>
      </section>

      <section className="reading" aria-labelledby="mass-energy-transfer">
        <h2 id="mass-energy-transfer">Three changes that test your explanation</h2>
        <details>
          <summary>Remove “Admit the unchanged-offset premise”. What survives?</summary>
          <p>
            The two balances and their subtraction survive. The combination K₀ − K₁ + (C₀ − C₁) is
            constrained, but K₀ − K₁ is not separately identified. An unspecified offset is not
            zero. With the premise relaxed, the laboratory below gives no number for the
            kinetic-energy loss, because the argument no longer fixes one.
          </p>
        </details>
        <details>
          <summary>
            Keep a finite observer speed. Is twice the kinetic-energy drop divided by v² the exact
            mass loss?
          </summary>
          <p>
            No. It is a finite-speed coefficient proxy. Identifying the mass loss uses its limit as
            v approaches zero. A zero-speed run alone gives zero kinetic-energy difference; dividing
            that result by zero is not the limit calculation.
          </p>
          <a href="/lab/me-02/">Compare the proxy, the approximation and the limit</a>
        </details>
        <details>
          <summary>Include the emitted light inside your system boundary. What changed?</summary>
          <p>
            The emitting body and the body-plus-radiation system are different systems. Energy that
            has left the body may remain inside a larger closed boundary. Do not transfer a
            statement about energy lost by the body to that larger system without a new account.
            Unequal pulses would also require a recoil calculation absent from this reconstruction.
          </p>
          <a href="/lab/me-03/">Move the system boundary</a>
        </details>
      </section>

      <section id="test-the-accounts" aria-labelledby="test-the-accounts-title">
        <h2 id="test-the-accounts-title">
          Test consequences with the existing two-ledger instrument
        </h2>
        <p>
          Predict whether tilting the emission axis changes each pulse energy, their sum, or both.
          Then vary the observer and relax the offset premise. These numbers are computed by the
          two-ledgers instrument, not by the argument checker above, and a computed consequence
          cannot check its own premises.
        </p>
        <TwoLedgersComparison
          example={{ ...DEFAULT_PREPARED_EXAMPLE, sourceDigest: labDigests["me-01"] }}
        />
      </section>
      <footer className="reading actions">
        <a className="button" href="/papers/mass-energy/#arg-me-two-ledgers">
          Read the argument as the paper makes it
        </a>
        <a href="/discover/mass-energy/">Back to the mass-energy route</a>
        <a href="/lab/me-02/">Continue to the small-speed coefficient</a>
      </footer>
    </article>
  );
}
