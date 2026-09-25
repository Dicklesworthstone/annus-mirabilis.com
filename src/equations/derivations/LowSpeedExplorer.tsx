"use client";
import { useEffect, useId, useRef, useState } from "react";
import {
  assessLowSpeed,
  decodeLowSpeedSetup,
  type LowSpeedOrder,
  type LowSpeedSelection,
  lowSpeedHref,
} from "./lowSpeedState.ts";
import type { LowSpeedFormula, LowSpeedProofView } from "./lowSpeedView.ts";
import "./linearProof.css";

function MathBlock({ value }: { value: LowSpeedFormula }) {
  return (
    <div className="linear-formula">
      <div className="linear-formula-scroll">
        <div aria-hidden="true" {...{ dangerouslySetInnerHTML: { __html: value.html } }} />
      </div>
      <div className="linear-mathml" {...{ dangerouslySetInnerHTML: { __html: value.mathml } }} />
      <p className="fine">{value.spoken}</p>
    </div>
  );
}
/** No coefficient calculation, physics or proof checking runs in this component. */
export function LowSpeedExplorer({
  proof,
  restoreSettings = true,
  moveAnchor,
}: {
  proof: LowSpeedProofView;
  restoreSettings?: boolean;
  /**
   * The id the move's step is published under, given only by the page's one instance
   * (MassEnergyLowSpeed): the explorer can be mounted twice, and an id must stay unique.
   */
  moveAnchor?: string | undefined;
}) {
  const id = `low-speed-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const [selection, setSelection] = useState<LowSpeedSelection>(() => ({
    selected: proof.certificate.premises.map((p) => p.id),
    order: 2,
  }));
  const [ready, setReady] = useState(false),
    [message, setMessage] = useState("");
  const container = useRef<HTMLElement>(null);
  useEffect(() => {
    if (restoreSettings) {
      const setup = decodeLowSpeedSetup(proof.certificate, window.location.search);
      if (setup.kind === "setup") {
        setSelection(setup.selection);
        const disclosure = container.current?.closest<HTMLDetailsElement>(
          "[data-low-speed-disclosure]",
        );
        if (disclosure) disclosure.open = true;
      } else if (setup.kind === "invalid") setMessage(setup.message);
    }
    setReady(true);
  }, [proof, restoreSettings]);
  const assessment = assessLowSpeed(proof.certificate, selection);
  const labels = new Map(proof.certificate.premises.map((p) => [p.id, p.label]));
  // A row's identity is the power of beta it reports, not its position in the array.
  const coefficientRows = proof.certificate.coefficients.map((coefficient, power) => ({
    power,
    coefficient,
  }));
  function status(step: string) {
    const result = assessment.find((item) => item.id === step)!;
    return (
      <p data-low-speed-state={result.status} data-low-speed-step={step}>
        {result.status === "supported"
          ? "Supported under the stated conditions."
          : `Not established by this selection. This step needs: ${result.missing.map((p) => labels.get(p)).join("; ")}. Its conditional explanation remains below.`}
      </p>
    );
  }
  function equation(name: string) {
    const e = proof.equations.find((e) => e.id === `eq-model-me-${name}`)!;
    return <MathBlock value={{ ...e, latex: e.plainLatex }} />;
  }
  const approximation = proof.approximations.find((a) => a.order === selection.order)!;
  return (
    <section
      ref={container}
      className="linear-proof"
      data-low-speed-proof
      data-proof-ready={ready}
      data-source-digest={proof.sourceDigest}
      aria-labelledby={`${id}-title`}
    >
      <h3 id={`${id}-title`}>Why does the coefficient become a mass decrease?</h3>
      <p>
        The ledger subtraction gives an energy difference. To identify inertia, we must take a
        low-speed limit and add the Newtonian meaning of mass. A single finite-speed calculation
        cannot replace either step.
      </p>
      <p className="notice">
        Modern teaching derivation. Exact algebra and local Taylor coefficients are checked, not the
        truth of the physical premises.
      </p>
      <p>{proof.certificate.domain}</p>
      <noscript>
        <p>
          The complete second-order, all-premise explanation is readable without JavaScript.
          Controls and shared premise selections require JavaScript; no prediction or answer is
          required to read the conclusion.
        </p>
      </noscript>
      <fieldset disabled={!ready} className="linear-controls">
        <legend>Examine the premises and approximation order</legend>
        {proof.certificate.premises.map((p) => (
          <div key={p.id}>
            <input
              id={`${id}-${p.id}`}
              type="checkbox"
              data-low-speed-premise={p.id}
              checked={selection.selected.includes(p.id)}
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                setSelection((current) => ({
                  ...current,
                  selected: checked
                    ? [...current.selected, p.id]
                    : current.selected.filter((item) => item !== p.id),
                }));
                setMessage("");
              }}
            />
            <label htmlFor={`${id}-${p.id}`}> {p.label}</label>
          </div>
        ))}
        <label htmlFor={`${id}-order`}>Powers retained in the modern Taylor comparison</label>
        <select
          id={`${id}-order`}
          data-low-speed-order
          value={selection.order}
          onChange={(event) => {
            // am-6iz4. currentTarget is only valid while the event is dispatching. Reading it
            // inside the updater, which React runs afterwards, threw "null is not an object".
            // Captured first, exactly as the checkbox handler above already does.
            const order = Number(event.currentTarget.value) as LowSpeedOrder;
            setSelection((current) => ({ ...current, order }));
          }}
        >
          <option value="2">Through second order</option>
          <option value="4">Through fourth order</option>
          <option value="6">Through sixth order</option>
        </select>
        <button
          type="button"
          onClick={() => {
            setSelection({ selected: proof.certificate.premises.map((p) => p.id), order: 2 });
            setMessage("");
          }}
        >
          Restore the complete argument
        </button>
      </fieldset>
      <p role="status" aria-live="polite" aria-atomic="true" data-low-speed-status>
        {assessment.find((s) => s.id === "identify")!.status === "supported"
          ? "The mass-decrease conclusion follows under all selected premises."
          : "The mass-decrease conclusion is not established by this premise selection."}{" "}
        The mathematical limit remains distinct from its physical interpretation. Changing the
        retained order does not change that limit.
      </p>
      {message && <p role="status">{message}</p>}
      <details>
        <summary>Read the physical premises in full</summary>
        {proof.certificate.premises.map((p) => (
          <p key={p.id}>
            <strong>{p.label}.</strong> {p.explanation}
          </p>
        ))}
      </details>
      <ol className="linear-step-list">
        <li>
          <h4>Expand the factor, not an assumed body energy</h4>
          {status("expand")}
          {equation("lorentz-factor")}
          <p>
            The expansion variable is the dimensionless ratio β = v/c. The positive radical is
            analytic near zero. Exact rational arithmetic gives the following coefficients of γ − 1;
            these are not fitted to plotted samples.
          </p>
          <div className="low-speed-table">
            <table>
              <caption>Exact coefficients of each power of β, through order eight</caption>
              <thead>
                <tr>
                  <th scope="col">Power</th>
                  <th scope="col">Coefficient</th>
                  <th scope="col">Current truncation</th>
                </tr>
              </thead>
              <tbody>
                {coefficientRows.map(({ power: k, coefficient }) => (
                  <tr key={`beta-power-${k}`}>
                    <th scope="row">β{sup(k)}</th>
                    <td>{coefficient}</td>
                    <td>
                      {k <= selection.order
                        ? "Retained"
                        : k === approximation.omittedPower
                          ? "First nonzero term omitted"
                          : "Beyond selected order"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <MathBlock value={approximation.formula} />
          <p data-leading-omitted>
            The first nonzero omitted term has coefficient {approximation.omittedCoefficient} and
            power {approximation.omittedPower}. A local order statement is not a numerical error
            bound at an arbitrary finite speed.
          </p>
          <p>
            <a
              href="/foundations/taylor-expansion/"
              data-foundation="taylor-expansion"
              data-return-caption="Return to the low-speed coefficient derivation."
            >
              Open the Taylor-expansion tool →
            </a>
          </p>
        </li>
        <li>
          <h4>Read the energy-of-motion coefficient</h4>
          {status("kinetic")}
          {equation("exact-drop")}
          <p>
            Using the already checked ledger argument, divide by the fixed positive emitted energy
            L. The first nonzero coefficient is exactly {proof.certificate.leadingCoefficient}.
            Multiplying back by L makes the leading term one half (L/c²)v². This remains conditional
            on the unchanged-offset premise.
          </p>
          {equation("quadratic-drop")}
          <p>
            <a href="/papers/mass-energy/#me-ledger-derivation">
              Inspect how the unknown body energies and shared offset were removed →
            </a>
          </p>
        </li>
        <li>
          <h4>Divide only away from zero speed</h4>
          {status("divide")}
          {equation("finite-speed-proxy")}
          <MathBlock value={proof.factorization} />
          <p>
            This exact rescaling uses β = v/c and v ≠ 0. It does not cancel a zero denominator. The
            finite-speed proxy retains its speed dependence; it is not yet the mass decrease.
          </p>
        </li>
        <li>
          <h4>Take the limit, not the value at zero</h4>
          {status("limit")}
          <MathBlock value={proof.limit} />
          <p>
            The constant and first-order coefficients of γ − 1 vanish exactly. Dividing by β² shifts
            the series by two powers; multiplying by two leaves constant term{" "}
            {proof.certificate.limit.limit}. All remaining terms tend to zero locally. This
            establishes the two-sided limit.
          </p>
          <p>
            <strong>At β = 0 the original quotient is still undefined.</strong> The analytic
            continuation has a value there, but it is not a measurement of the finite-speed proxy at
            zero.
          </p>
          <details>
            <summary>Inspect the exact regularized coefficients</summary>
            <p>
              Coefficients from power zero through power {proof.certificate.limit.order}:{" "}
              {proof.certificate.limit.coefficients.join(", ")}. The nonzero β² coefficient is why
              the finite-speed ratio is not identically its limit.
            </p>
          </details>
        </li>
        {/* The move (plan §9.1 item 6, §11 ME-02): the one step the paper asks the reader to accept
            rather than check, named as such. Journey IV's marker links here by its anchor. */}
        <li id={moveAnchor} data-move-step>
          <h4>The move: read the coefficient as a lost mass</h4>
          {status("identify")}
          {equation("mass-decrease")}
          <p>
            The Newtonian low-speed meaning of inertial mass says that the coefficient of v² in the
            kinetic-energy decrease is one half the mass decrease. Comparing it with one half L/c²
            identifies the positive mass loss. It does not assign either absolute body energy or
            assume a rest-energy formula.
          </p>
          <p>
            Without that Newtonian premise, the mathematical limit survives but the identification
            as a mass decrease does not. Removing the unchanged-offset premise instead breaks the
            connection between the ledger difference and kinetic energy.
          </p>
        </li>
      </ol>
      <p>
        <a href="/lab/me-02/?beta=0.6&L=1&unit=joule#coefficient-equations">
          Compare the exact drop, finite-speed proxy and limit at 0.6c in the laboratory →
        </a>
      </p>
      <p>
        <a data-low-speed-share href={lowSpeedHref(proof.certificate, selection)}>
          Share this premise selection and retained order
        </a>
      </p>
      <details>
        <summary>What the check establishes, and what it does not</summary>
        <p>{proof.certificate.scope}</p>
        <p>
          The binomial-series identity used by the checker is documented in{" "}
          <a href="https://dlmf.nist.gov/4.6.E7">NIST DLMF 4.6.7</a>. This is a modern mathematical
          reference, not an item on the 1904 historical shelf.
        </p>
      </details>
    </section>
  );
}
function sup(power: number) {
  return <sup>{power}</sup>;
}
