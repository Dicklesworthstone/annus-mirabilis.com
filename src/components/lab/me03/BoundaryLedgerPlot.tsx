import type { Me03Parameters } from "../../../experiments/me03/definition.ts";
import type { Me03Snapshot } from "../../../experiments/me03/session.ts";
import type { ScientificResult } from "../../../experiments/results/types.ts";
import { Sci } from "../Sci.tsx";

export interface BoundaryLedgerPlotProps {
  parameters: Me03Parameters;
  evaluation: Me03Snapshot;
  clipId: string;
}

function ResultNumber({ result, unit }: { result: ScientificResult; unit: string }) {
  if (result.status === "value" && typeof result.value === "number") {
    return (
      <>
        <Sci value={result.value} digits={5} />
        {unit ? ` ${unit}` : ""}
      </>
    );
  }
  return (
    <span className="fine">
      {"reason" in result ? result.reason : "No numeric value is assigned."}
    </span>
  );
}

const SUPERSCRIPT: Readonly<Record<string, string>> = {
  "-": "⁻",
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
};

/** The reference strings spell a power with a caret ("10^-10", "c^2"); a reader reads 10⁻¹⁰. */
function powers(text: string): string {
  return text.replace(/\^(-?\d+)/g, (_, exponent: string) =>
    [...exponent].map((ch) => SUPERSCRIPT[ch] ?? ch).join(""),
  );
}

/** "4.259 × 10^9 kg/s (4.3 million tonnes/s)" as a value line and the note after it. */
export function splitFigure(text: string): { value: string; note: string } {
  const match = /^(.*\S)\s+(\([^()]*\))$/.exec(text);
  return match
    ? { value: powers(match[1] ?? text), note: powers(match[2] ?? "") }
    : { value: powers(text), note: "" };
}

// The same words the lab's own controls use, so a reader never meets an internal id.
const BOUNDARY_WORDS: Readonly<Record<Me03Parameters["boundary"], string>> = {
  "body-alone": "The body alone",
  radiation: "The radiation",
  "combined-isolated-system": "Both, as one isolated system",
};
const DISPOSITION_WORDS: Readonly<Record<Me03Parameters["disposition"], string>> = {
  escapes: "escapes",
  retained: "is absorbed inside an enclosure",
  "partly-retained": "is partly absorbed inside an enclosure",
};

// The diagram is 300 units wide, about a phone's width, so its 12-unit labels read near 12px there
// without any scaling rule. Its sentences are HTML beside it.
const label = { fontSize: "12px", fontFamily: "var(--font-sans)" } as const;

export function BoundaryLedgerPlot({ parameters, evaluation, clipId }: BoundaryLedgerPlotProps) {
  const { boundary, disposition, mode, pulseSystem, notation } = parameters;
  const isModern = notation === "modern";
  const lightSpeed = isModern ? "c" : "V";
  const isFourMomentum = mode === "four-momentum";
  const card = evaluation.card;
  const massChange = splitFigure(card.massChangeFormatted);

  const invMass =
    evaluation.invariantMass.status === "value" ? evaluation.invariantMass.value : null;
  const emission = evaluation.modernEmission;

  const isolated = boundary === "combined-isolated-system";
  const pulseWords =
    pulseSystem === "single-pulse"
      ? `One light pulse: P = (L/${lightSpeed}, L/${lightSpeed}, 0, 0), so P·P = 0 and m = 0`
      : pulseSystem === "two-collinear"
        ? `Two pulses in the same direction: P = (L/${lightSpeed}, L/${lightSpeed}, 0, 0), so P·P = 0 and m = 0`
        : `Two pulses in opposite directions: P = (L/${lightSpeed}, 0, 0, 0), so P·P = (L/${lightSpeed})² and m = L/${lightSpeed}²`;

  return (
    <div
      className="boundary-ledger-svg-wrap"
      data-boundary={boundary}
      data-disposition={disposition}
      data-mode={mode}
      data-card-id={card.id}
      data-view-id="me-03-boundary-ledger"
    >
      <div className="me03-figure-grid">
        <div className="boundary-diagram">
          <p className="me03-figure-title">
            {isFourMomentum ? "The light's four-momentum" : "Where the boundary is drawn"}
          </p>
          <p className="fine me03-figure-sub">
            {isFourMomentum
              ? pulseWords
              : `Inside the boundary: ${BOUNDARY_WORDS[boundary].toLowerCase()}. The radiation ${DISPOSITION_WORDS[disposition]}.`}
          </p>
          <svg
            viewBox="0 0 300 210"
            className="boundary-ledger-canvas"
            role="img"
            aria-label={
              isFourMomentum
                ? pulseWords
                : `Inside the boundary: ${BOUNDARY_WORDS[boundary].toLowerCase()}; the radiation ${DISPOSITION_WORDS[disposition]}`
            }
          >
            <defs>
              <clipPath id={clipId}>
                <rect x="0" y="0" width="300" height="210" />
              </clipPath>
              <marker
                id="arrow-energy"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ea580c" />
              </marker>
              <marker
                id="arrow-pulse1"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#2563eb" />
              </marker>
            </defs>

            {!isFourMomentum ? (
              <g>
                {/* The isolated system: the body and whatever it radiates */}
                <rect
                  x="10"
                  y="10"
                  width="260"
                  height="190"
                  rx="10"
                  fill={isolated ? "var(--wash)" : "none"}
                  stroke={isolated ? "var(--accent)" : "var(--line)"}
                  strokeWidth={isolated ? "2.5" : "1.5"}
                  strokeDasharray={isolated ? "none" : "6 4"}
                />
                <text
                  x="20"
                  y="30"
                  fontWeight={isolated ? "bold" : "normal"}
                  fill={isolated ? "var(--accent)" : "var(--muted)"}
                  style={label}
                >
                  isolated system
                </text>

                {/* The emitting body */}
                <rect
                  x="30"
                  y="60"
                  width="100"
                  height="100"
                  rx="8"
                  fill={boundary === "body-alone" ? "var(--wash)" : "var(--panel)"}
                  stroke={boundary === "body-alone" ? "var(--accent)" : "var(--line)"}
                  strokeWidth={boundary === "body-alone" ? "2.5" : "1.5"}
                />
                <text
                  x="80"
                  y="105"
                  textAnchor="middle"
                  fontWeight="bold"
                  fill="var(--ink)"
                  style={label}
                >
                  body
                </text>
                <text x="80" y="125" textAnchor="middle" fill="var(--muted)" style={label}>
                  Δm = −L/{lightSpeed}²
                </text>

                {disposition === "escapes" ? (
                  <g className="radiation-escapes">
                    <line
                      x1="130"
                      y1="110"
                      x2="290"
                      y2="110"
                      stroke="#ea580c"
                      strokeWidth="3"
                      markerEnd="url(#arrow-energy)"
                    />
                    <text
                      x="205"
                      y="98"
                      textAnchor="middle"
                      fontWeight="bold"
                      fill="var(--ink)"
                      style={label}
                    >
                      radiation, L
                    </text>
                  </g>
                ) : (
                  <g className="radiation-retained">
                    <path
                      d="M 130 110 Q 200 70 210 130"
                      fill="none"
                      stroke="#ea580c"
                      strokeWidth="2.5"
                      markerEnd="url(#arrow-energy)"
                    />
                    <rect
                      x="175"
                      y="132"
                      width="80"
                      height="40"
                      rx="4"
                      fill="var(--wash)"
                      stroke="var(--line)"
                    />
                    <text
                      x="215"
                      y="157"
                      textAnchor="middle"
                      fontWeight="bold"
                      fill="var(--ink)"
                      style={label}
                    >
                      absorber
                    </text>
                    <text
                      x="200"
                      y="68"
                      textAnchor="middle"
                      fontWeight="bold"
                      fill="var(--ink)"
                      style={label}
                    >
                      radiation, L
                    </text>
                  </g>
                )}
              </g>
            ) : (
              <g>
                <rect
                  x="10"
                  y="10"
                  width="280"
                  height="190"
                  rx="8"
                  fill="var(--wash)"
                  stroke="var(--line)"
                  strokeWidth="1"
                />
                {pulseSystem === "single-pulse" && (
                  <g transform="translate(150, 105)">
                    <circle cx="0" cy="0" r="6" fill="#2563eb" />
                    <line
                      x1="0"
                      y1="0"
                      x2="80"
                      y2="0"
                      stroke="#2563eb"
                      strokeWidth="3"
                      markerEnd="url(#arrow-pulse1)"
                    />
                  </g>
                )}
                {pulseSystem === "two-collinear" && (
                  <g transform="translate(150, 105)">
                    <line
                      x1="-40"
                      y1="-12"
                      x2="60"
                      y2="-12"
                      stroke="#2563eb"
                      strokeWidth="2.5"
                      markerEnd="url(#arrow-pulse1)"
                    />
                    <line
                      x1="-40"
                      y1="12"
                      x2="60"
                      y2="12"
                      stroke="#2563eb"
                      strokeWidth="2.5"
                      markerEnd="url(#arrow-pulse1)"
                    />
                  </g>
                )}
                {pulseSystem === "two-opposite" && (
                  <g transform="translate(150, 105)">
                    <line
                      x1="0"
                      y1="0"
                      x2="80"
                      y2="0"
                      stroke="#2563eb"
                      strokeWidth="3"
                      markerEnd="url(#arrow-pulse1)"
                    />
                    <line
                      x1="0"
                      y1="0"
                      x2="-80"
                      y2="0"
                      stroke="#ea580c"
                      strokeWidth="3"
                      markerEnd="url(#arrow-energy)"
                    />
                    <circle cx="0" cy="0" r="7" fill="var(--ink)" />
                  </g>
                )}
                <text x="150" y="180" textAnchor="middle" fill="var(--ink)" style={label}>
                  m = {invMass === null ? "unavailable" : invMass === 0 ? "0" : `L/${lightSpeed}²`}
                </text>
              </g>
            )}
          </svg>
        </div>

        <div className="ledger-card-summary">
          <p className="me03-figure-title">
            {isFourMomentum ? "Four-momentum summary" : "Energy and mass inside the boundary"}
          </p>
          <dl className="me03-ledger" data-results>
            <div>
              <dt>Inside the boundary</dt>
              <dd>{BOUNDARY_WORDS[boundary]}</dd>
            </div>
            <div>
              <dt>Energy change ΔE</dt>
              <dd>
                <ResultNumber result={evaluation.energyChange} unit="J" />
              </dd>
            </div>
            <div>
              <dt>{isFourMomentum ? "Invariant-mass change Δm" : "Mass change Δm"}</dt>
              <dd className="me03-ledger-accent">
                <ResultNumber result={evaluation.massChange} unit="kg" />
              </dd>
            </div>
          </dl>
          {isFourMomentum && emission && (
            <section
              aria-label="Conserved emission and emitter recoil"
              data-modern-emission-status={emission.status}
            >
              <p className={emission.status === "outside-domain" ? "notice error" : "fine"}>
                {emission.reason} {emission.condition}.
              </p>
              {emission.status === "outside-domain" && (
                <p className="fine">
                  The radiation-only mass below describes the chosen pulses. It does not establish
                  that this initial body can emit them.
                </p>
              )}
              {emission.status === "value" ? (
                <dl className="me03-ledger">
                  <div>
                    <dt>Initial body energy M₀c²</dt>
                    <dd>
                      <ResultNumber result={emission.outputs.initialEmitterEnergy} unit="J" />
                    </dd>
                  </div>
                  <div>
                    <dt>Remaining body energy</dt>
                    <dd>
                      <ResultNumber result={emission.outputs.remainingEmitterEnergy} unit="J" />
                    </dd>
                  </div>
                  <div>
                    <dt>Remaining invariant mass</dt>
                    <dd>
                      <ResultNumber result={emission.outputs.remainingEmitterMass} unit="kg" />
                    </dd>
                  </div>
                  <div>
                    <dt>Body rest-mass change</dt>
                    <dd>
                      <ResultNumber result={emission.outputs.emitterMassChange} unit="kg" />
                    </dd>
                  </div>
                  <div>
                    <dt>Body x velocity c²p/E</dt>
                    <dd>
                      <ResultNumber result={emission.outputs.emitterRecoilVelocity} unit="m/s" />
                    </dd>
                  </div>
                  <div>
                    <dt>Recoil energy E − mc²</dt>
                    <dd>
                      <ResultNumber result={emission.outputs.emitterKineticEnergy} unit="J" />
                    </dd>
                  </div>
                  <div>
                    <dt>Radiation invariant mass</dt>
                    <dd>
                      <ResultNumber result={evaluation.invariantMass} unit="kg" />
                    </dd>
                  </div>
                  <div>
                    <dt>Radiation x momentum</dt>
                    <dd>
                      <ResultNumber result={emission.outputs.radiationMomentum} unit="kg·m/s" />
                    </dd>
                  </div>
                  <div>
                    <dt>Body x momentum</dt>
                    <dd>
                      <ResultNumber result={emission.outputs.emitterMomentum} unit="kg·m/s" />
                    </dd>
                  </div>
                  <div>
                    <dt>Emitted fraction L/(M₀c²)</dt>
                    <dd>
                      <ResultNumber result={emission.outputs.emittedRestEnergyFraction} unit="" />
                    </dd>
                  </div>
                </dl>
              ) : (
                <dl className="me03-ledger">
                  <div>
                    <dt>Radiation invariant mass</dt>
                    <dd>
                      <ResultNumber result={evaluation.invariantMass} unit="kg" />
                    </dd>
                  </div>
                </dl>
              )}
              <p className="fine">
                All energies and momenta use the initial body's rest frame. The modern relation
                gives E<sub>body</sub> = M₀c² − L, p<sub>body</sub> = −p<sub>light</sub>, and m²c⁴ =
                E<sub>body</sub>² − p<sub>body</sub>²c². For an admitted emission, the combined
                isolated system keeps its initial energy, zero momentum, and invariant mass M₀. Its
                invariant mass is not the sum of the separate rest masses.
              </p>
              <p className="fine">
                A nonzero directed pulse leaves recoil energy, so the body's rest-mass loss exceeds
                L/c². Equal opposite pulses give zero recoil and recover the symmetric mass loss
                L/c². The loss and recoil energy are evaluated without subtracting nearly equal
                values; rounded before-and-after masses can therefore look equal while their change
                is nonzero. At a lightlike endpoint, c²p/E describes energy transport and does not
                define a massive emitter's rest frame.{" "}
                <a href="/papers/mass-energy/s0/">Read the original symmetric-emission argument.</a>
              </p>
            </section>
          )}
          {/* The selected case's energy figure, whether matter crosses, and "closed but not
              isolated" are facts 3, 6 and 7 in the panel under the drawing, so they are not
              repeated here. */}
          <dl className="me03-ledger me03-ledger-case">
            <div>
              <dt>{isFourMomentum ? "Separate cited case" : "Case study"}</dt>
              <dd>{card.label}</dd>
            </div>
            <div>
              <dt>Mass change</dt>
              <dd className="me03-ledger-accent">
                {massChange.value}
                {massChange.note ? <span className="fine"> {massChange.note}</span> : null}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
