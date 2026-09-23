"use client";

import { useEffect, useId, useReducer, useState } from "react";
import type { EntranceRecord } from "../../content/entrances/entranceRecord.ts";
import type { EntranceScalar, MassEnergyEntranceScenario } from "./massEnergyExample.ts";
import { MASS_ENERGY_ENTRANCE_INITIAL, reduceMassEnergyEntrance } from "./massEnergyState.ts";
import "./massEnergyEntrance.css";

const LEDGER_STEPS = ["intro", "two-balances", "subtraction-move", "premise-kinetic"] as const;
const PHASES = [
  "Compare the accounts",
  "Align before with before",
  "Subtract the losses",
  "Name the premise",
] as const;

function Amount({ reading }: { reading: EntranceScalar }) {
  return (
    <span
      data-quantity-id={reading.quantityId}
      data-owner-id={reading.ownerId}
      data-value={reading.value}
    >
      {reading.text} J
    </span>
  );
}

function SubtractionSteps({
  scenario,
  phase,
  unchanged,
}: {
  scenario: MassEnergyEntranceScenario;
  phase: number;
  unchanged: boolean;
}) {
  return (
    <ol className="me-subtraction-steps">
      <li>
        Each account conserves energy. The body loses exactly what its departing light carries.
      </li>
      <li hidden={phase < 1}>
        Align the two before entries, then the two after entries. The unknown body energies remain
        unknown.
      </li>
      <li hidden={phase < 2}>
        Subtract the losses: <Amount reading={scenario.movingLight} /> minus{" "}
        <Amount reading={scenario.restLight} /> leaves{" "}
        <strong>
          <Amount reading={scenario.subtraction} />
        </strong>
        . This is a difference between accounts, not an absolute body energy.
      </li>
      <li
        hidden={phase < 3}
        data-kinetic-status={unchanged ? "value" : scenario.relaxedKinetic.status}
      >
        {unchanged ? (
          <>
            With the unchanged-offset premise, the body’s energy of motion decreases by{" "}
            <strong>
              <Amount reading={scenario.kinetic} />
            </strong>{" "}
            at the same speed.
          </>
        ) : (
          <>
            Without the unchanged-offset premise, the change in energy of motion is{" "}
            <strong>underdetermined</strong>. The algebraic difference above is still known; an
            unknown change in the offset could contribute to it.
          </>
        )}
      </li>
    </ol>
  );
}

export function MassEnergyFirstEncounter({
  record,
  scenarios,
  sourceDigest,
}: {
  record: EntranceRecord;
  scenarios: readonly MassEnergyEntranceScenario[];
  sourceDigest: string;
}) {
  const id = useId();
  const [state, dispatch] = useReducer(reduceMassEnergyEntrance, MASS_ENERGY_ENTRANCE_INITIAL);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const scenario = scenarios.find((item) => item.id === state.scenarioId);
  const slow = scenarios.find((item) => item.id === "slow");
  if (!scenario || !slow) throw new Error("The prepared mass-energy entrance is incomplete.");
  const kineticAnnouncement = state.unchangedOffset
    ? `With the unchanged offset, energy of motion decreases by ${scenario.kinetic.text} joules.`
    : "Without the unchanged offset, the change in energy of motion is underdetermined.";

  return (
    <section
      id="entry-mass-energy"
      tabIndex={-1}
      className="reader-passage me-entrance"
      aria-labelledby={`${id}-title`}
      data-encounter-id={record.id}
      data-paper="mass-energy"
      data-source-digest={sourceDigest}
      data-execution-label="prepared-reference-example"
      data-encounter-ready={ready}
      data-encounter-phase={state.phase}
      data-encounter-scenario={state.scenarioId}
    >
      <header>
        <p className="eyebrow">First encounter · No algebra required</p>
        <h2 id={`${id}-title`}>{record.question}</h2>
        <p>{record.story}</p>
        <p className="notice">
          Authored teaching example, calculated when the site was built. Each energy unit here is
          one joule (J). Numbers use the modern SI constant set, not an observation or a reviewed
          source transcription.
        </p>
      </header>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-encounter-announcement
      >
        {state.revision > 0
          ? `${scenario.speedLabel}. ${PHASES[state.phase]}. ${state.phase >= 2 ? `The accounts differ by ${scenario.subtraction.text} joules. ` : ""}${state.phase >= 3 ? kineticAnnouncement : ""}`
          : ""}
      </div>
      <fieldset disabled={!ready}>
        <legend>Choose the traveler</legend>
        <div className="actions">
          {scenarios.map((item) => (
            <button
              key={item.id}
              type="button"
              className="secondary"
              aria-pressed={state.scenarioId === item.id}
              onClick={() => dispatch({ type: "scenario", id: item.id })}
            >
              {item.speedLabel}
            </button>
          ))}
        </div>
      </fieldset>
      <p>
        <strong>The traveler keeps the same speed before and after:</strong> {scenario.speedLabel}.
        Equal opposite emission prevents recoil in this model.
      </p>
      <div className="me-ledgers" data-accounts-aligned={state.phase >= 1}>
        <article
          draggable={ready}
          onDragStart={(event) => {
            event.dataTransfer.setData("application/x-annus-ledger", "rest");
            event.dataTransfer.effectAllowed = "move";
          }}
        >
          <h3>Beside the body</h3>
          <p>
            Before: <strong data-body-energy="rest-before">unknown</strong>
          </p>
          <p>
            After:{" "}
            <strong data-body-energy="rest-after">
              that unknown amount minus <Amount reading={scenario.restLight} />
            </strong>
          </p>
          <p>
            Light: <Amount reading={scenario.restPulse} /> in each of two opposite directions.
          </p>
          <p>
            Total light:{" "}
            <strong>
              <Amount reading={scenario.restLight} />
            </strong>
          </p>
        </article>
        <article>
          <h3>The traveler’s account</h3>
          <p>
            Before: <strong data-body-energy="moving-before">another unknown</strong>
          </p>
          <p>
            After:{" "}
            <strong data-body-energy="moving-after">
              that unknown amount minus <Amount reading={scenario.movingLight} />
            </strong>
          </p>
          <p>
            Light: <Amount reading={scenario.movingPulse1} /> one way;{" "}
            <Amount reading={scenario.movingPulse2} /> the other way.
          </p>
          <p>
            Total light:{" "}
            <strong>
              <Amount reading={scenario.movingLight} />
            </strong>
          </p>
        </article>
      </div>
      {/*
        A <section> with a name rather than a bare <div>: the drop zone carries
        drag handlers, and an element with handlers and no role is announced as
        nothing. The button inside it already performs the identical action, so
        the non-drag path AGENTS.md requires exists and is named in the copy.
      */}
      <section
        className="me-align-target"
        aria-label="Align the accounts"
        onDragOver={(event) => {
          if (ready) event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (ready && event.dataTransfer.getData("application/x-annus-ledger") === "rest")
            dispatch({ type: "align" });
        }}
      >
        <button
          type="button"
          disabled={!ready || state.phase >= 1}
          onClick={() => dispatch({ type: "align" })}
        >
          Align the accounts
        </button>
        <p className="fine">
          Use the button, or drag the “Beside the body” card here. Both actions perform the same
          alignment.
        </p>
      </section>
      <h3>{PHASES[state.phase]}</h3>
      <div data-encounter-live>
        <SubtractionSteps
          scenario={scenario}
          phase={state.phase}
          unchanged={state.unchangedOffset}
        />
      </div>
      <div className="actions">
        <button
          type="button"
          className="secondary"
          disabled={!ready || state.phase === 0}
          onClick={() => dispatch({ type: "back" })}
        >
          Previous step
        </button>
        <button
          type="button"
          disabled={!ready || state.phase === 3}
          onClick={() => dispatch({ type: "next" })}
        >
          Next step
        </button>
        <button
          type="button"
          className="secondary"
          disabled={!ready || state.phase === 3}
          onClick={() => dispatch({ type: "show-all" })}
        >
          Show the complete subtraction
        </button>
      </div>
      <fieldset disabled={!ready} className="me-premise">
        <legend>Test the interpretation, not the arithmetic</legend>
        <label className="check">
          <input
            type="checkbox"
            checked={state.unchangedOffset}
            onChange={(event) => dispatch({ type: "premise", unchanged: event.target.checked })}
          />
          Assume the additive offset is unchanged during emission
        </label>
        <p>{record.agreement}</p>
        <p hidden={state.phase < 3} data-premise-conclusion>
          {kineticAnnouncement}
        </p>
      </fieldset>
      <details className="me-static-solution">
        <summary>
          Read the full worked example without controls (also works without JavaScript)
        </summary>
        <p>The unchanged-offset premise is assumed in this static worked route.</p>
        {scenarios.map((item) => (
          <section key={item.id}>
            <h3>{item.speedLabel}</h3>
            <SubtractionSteps scenario={item} phase={3} unchanged />
          </section>
        ))}
        <p>
          Relaxing the unchanged-offset premise leaves the difference between accounts known but the
          energy-of-motion change underdetermined.
        </p>
      </details>
      <h3>Why the slower traveler matters</h3>
      <p>{record.consistencyCase}</p>
      {/*
        KEEP the tabIndex. Measured against the built site, both rendered instances
        overflow at 320px: 480/262 scrollWidth over clientWidth (1280px: 730/730). The
        tabIndex is the keyboard's only route into the hidden 218 pixels.
        a11y/noNoninteractiveTabindex flags this and its FIXABLE fix deletes the
        attribute; `me-table` is NOT in AUDITED_SCROLL_CLASSES, so the scrollable-regions
        ratchet would not catch that removal either (am-6iz4, am-uj6w).
      */}
      <section className="me-table" aria-label="Two-speed energy comparison" tabIndex={0}>
        <table>
          <caption>
            Same emission, two speeds. The exact-within-model drop and its low-speed approximation
            are different quantities. Kinetic interpretation assumes the unchanged offset.
          </caption>
          <thead>
            <tr>
              <th scope="col">Traveler speed</th>
              <th scope="col">Rest-frame light</th>
              <th scope="col">Moving-frame light</th>
              <th scope="col">Exact drop</th>
              <th scope="col">Low-speed approximation</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((item) => (
              <tr key={item.id}>
                <th scope="row">{item.speedLabel}</th>
                <td>
                  <Amount reading={item.restLight} />
                </td>
                <td>
                  <Amount reading={item.movingLight} />
                </td>
                <td>
                  <Amount reading={item.subtraction} />
                </td>
                <td>
                  <Amount reading={item.quadratic} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {/* ON A PHONE THE TWO SPEEDS ARE TWO SHORT LISTS. The 1 percent row holds values like
          0.0005000375031 J, so the table cannot narrow: at 320 it was 480px in a 262px box with
          218px out of view behind a sideways scroll. Below 40em each speed is its own list and
          the table is not displayed; above it, the table only, so a reader meets each number
          once. */}
      <div className="me-speed-lists">
        <p className="fine">
          Same emission, two speeds. The exact-within-model drop and its low-speed approximation are
          different quantities. Kinetic interpretation assumes the unchanged offset.
        </p>
        {scenarios.map((item) => (
          <div key={item.id} className="me-speed">
            <p className="me-speed-label">{item.speedLabel}</p>
            <dl>
              <div>
                <dt>Rest-frame light</dt>
                <dd>
                  <Amount reading={item.restLight} />
                </dd>
              </div>
              <div>
                <dt>Moving-frame light</dt>
                <dd>
                  <Amount reading={item.movingLight} />
                </dd>
              </div>
              <div>
                <dt>Exact drop</dt>
                <dd>
                  <Amount reading={item.subtraction} />
                </dd>
              </div>
              <div>
                <dt>Low-speed approximation</dt>
                <dd>
                  <Amount reading={item.quadratic} />
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
      <p>
        The large-number example makes the subtraction easy to see. To identify inertia, compare at
        low speed: the energy of motion then follows the ordinary speed-squared rule. The high-speed
        result cannot make that approximation exact.
      </p>
      {record.helpEntries.map((help) => (
        <details key={help.obstacle}>
          <summary>{help.obstacle}</summary>
          <p>{help.clarification}</p>
        </details>
      ))}
      <section className="me-bridge" aria-label={record.bridge.title}>
        <h3>{record.bridge.title}</h3>
        <p>
          <strong>The new skill:</strong> {record.bridge.newSkill}
        </p>
        <p>
          <strong>Why it helps here:</strong> {record.bridge.whyUsefulHere}
        </p>
        <p>
          <a
            id="me-entrance-work-energy"
            href="/foundations/work-energy/"
            data-foundation="work-energy"
            data-return-caption="Return to comparing the two energy accounts."
          >
            More guidance: energy of motion and inertia →
          </a>
        </p>
        <p>
          <a
            href={`${scenario.me01Href}&premise=${state.unchangedOffset ? "unchanged" : "relaxed"}&step=${LEDGER_STEPS[state.phase] ?? "intro"}`}
          >
            Less guidance: open these exact two-ledger settings in ME-01 →
          </a>
        </p>
        {state.unchangedOffset ? (
          <p>
            <a href={slow.me02Href}>
              Continue with the slow traveler in the coefficient laboratory →
            </a>
          </p>
        ) : (
          <p>
            The coefficient laboratory requires the unchanged-offset premise. Re-enable that premise
            to continue.
          </p>
        )}
        <p>
          <a href="#arg-me-import" data-reader-anchor="arg-me-import">
            Follow the complete explanatory argument →
          </a>
        </p>
      </section>
    </section>
  );
}
