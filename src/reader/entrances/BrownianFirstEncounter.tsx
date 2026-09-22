"use client";

import { useCallback, useId, useRef, useState } from "react";
import type { EntranceRecord } from "../../content/entrances/entranceRecord.ts";
import {
  AUTHORED_BROWNIAN_DISPLACEMENTS,
  calculateSignedDisplacements,
  DOUBLED_BROWNIAN_DISPLACEMENTS,
  describeDisplacementInWords,
  formatSignedDisplacement,
} from "./signedDisplacements.ts";

const PARTICLE_KEYS = ["particle-1", "particle-2", "particle-3", "particle-4"] as const;

export interface BrownianFirstEncounterProps {
  readonly record?: EntranceRecord | undefined;
  readonly initialEntries?: readonly number[] | undefined;
  readonly onNavigateFoundation?: ((foundationId: string) => void) | undefined;
  readonly onNavigateInstrument?: ((instrumentId: string) => void) | undefined;
}

export function BrownianFirstEncounter({
  record,
  initialEntries = AUTHORED_BROWNIAN_DISPLACEMENTS,
  onNavigateFoundation,
  onNavigateInstrument,
}: BrownianFirstEncounterProps) {
  const [entries, setEntries] = useState<readonly number[]>(initialEntries);
  const [activeTab, setActiveTab] = useState<"visual" | "table">("visual");
  const [showWhySquare, setShowWhySquare] = useState<boolean>(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>("");

  const liveRegionId = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const totals = calculateSignedDisplacements(entries);
  const isAuthored =
    entries.length === 4 &&
    entries[0] === -3 &&
    entries[1] === -1 &&
    entries[2] === 1 &&
    entries[3] === 3;

  const isDoubled =
    entries.length === 4 &&
    entries[0] === -6 &&
    entries[1] === -2 &&
    entries[2] === 2 &&
    entries[3] === 6;

  const updateEntry = useCallback((index: number, nextVal: number) => {
    const clamped = Math.max(-10, Math.min(10, Math.round(nextVal)));
    setEntries((prev) => {
      const next = [...prev];
      next[index] = clamped;
      const newTotals = calculateSignedDisplacements(next);
      setLiveAnnouncement(
        `Particle ${index + 1} set to ${formatSignedDisplacement(clamped)} units. Signed sum: ${newTotals.signedSum}, mean absolute: ${newTotals.meanAbsolute}, mean square: ${newTotals.meanSquare}, RMS: ${newTotals.rootMeanSquare.toFixed(3)}.`,
      );
      return Object.freeze(next);
    });
  }, []);

  const handlePointerDown = useCallback(
    (idx: number, e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const track = trackRef.current;
      const updateFromClientX = (clientX: number) => {
        const rect = track?.getBoundingClientRect();
        const width = rect && rect.width > 0 ? rect.width : 320;
        const left = rect && rect.width > 0 ? rect.left : 0;
        const fraction = Math.max(0, Math.min(1, (clientX - left) / width));
        const nextPos = Math.round(fraction * 16 - 8);
        updateEntry(idx, nextPos);
      };

      updateFromClientX(e.clientX);

      const onPointerMove = (ev: PointerEvent) => {
        updateFromClientX(ev.clientX);
      };

      const onPointerUp = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [updateEntry],
  );

  const resetToAuthored = useCallback(() => {
    setEntries(AUTHORED_BROWNIAN_DISPLACEMENTS);
    const t = calculateSignedDisplacements(AUTHORED_BROWNIAN_DISPLACEMENTS);
    setLiveAnnouncement(
      `Restored authored example: -3, -1, +1, +3 units. Signed sum: ${t.signedSum}, mean absolute: ${t.meanAbsolute}, mean square: ${t.meanSquare}.`,
    );
  }, []);

  const setToDoubled = useCallback(() => {
    setEntries(DOUBLED_BROWNIAN_DISPLACEMENTS);
    const t = calculateSignedDisplacements(DOUBLED_BROWNIAN_DISPLACEMENTS);
    setLiveAnnouncement(
      `Set to doubled displacements: -6, -2, +2, +6 units. Signed sum: ${t.signedSum}, mean absolute: ${t.meanAbsolute}, mean square: ${t.meanSquare}.`,
    );
  }, []);

  const particleItems = PARTICLE_KEYS.map((key, idx) => ({
    key,
    index: idx,
    position: entries[idx] ?? 0,
  }));

  return (
    <div
      id="entry-brownian-motion"
      data-encounter-id="entrance-brownian-motion"
      data-paper="brownian-motion"
      className="encounter"
    >
      {/* Header */}
      <header>
        <span className="eyebrow">First encounter · Zero algebra entrance</span>
        <h2>
          {record?.question ?? "Do particles that wander in all directions ever get anywhere?"}
        </h2>
        <p className="lead">
          {record?.story ??
            "Imagine placing a microscopic particle in a drop of water and marking where it is after a few moments. Pushed at random by invisible water molecules, it is just as likely to move left as right. In the symmetric arithmetic example below, signed displacements cancel even though all four endpoints differ from the starting point."}
        </p>
      </header>

      {/* Screen Reader Live Region */}
      <div
        id={liveRegionId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="visually-hidden"
      >
        {liveAnnouncement}
      </div>

      {/* Authored notice */}
      <div className="notice" style={{ marginBottom: "1.5rem" }}>
        <span>
          <strong>Authored arithmetic examples:</strong> Displacements of −3, −1, +1, and +3 units
          (three steps left, one left, one right, three right). These are an authored educational
          case, not a measured dataset.
        </span>
        <div className="button-group" style={{ marginTop: "0.5rem" }}>
          {!isAuthored && (
            <button type="button" onClick={resetToAuthored} className="button secondary">
              Back to authored example
            </button>
          )}
          {!isDoubled && (
            <button type="button" onClick={setToDoubled} className="button secondary">
              Show doubled example (−6, −2, +2, +6)
            </button>
          )}
        </div>
      </div>

      {/* View Mode Toggle */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <h3>Step 1 · Explore the particle displacements</h3>
        <fieldset className="button-group" aria-label="Interaction mode">
          <button
            type="button"
            onClick={() => setActiveTab("visual")}
            className={`button ${activeTab === "visual" ? "" : "secondary"}`}
          >
            Visual Number Line
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("table")}
            className={`button ${activeTab === "table" ? "" : "secondary"}`}
          >
            Table & Numeric Inputs
          </button>
        </fieldset>
      </div>

      {/* Interactive Display */}
      {activeTab === "visual" ? (
        <div className="notice" style={{ marginBottom: "1.5rem" }}>
          <p className="fine" style={{ marginBottom: "0.75rem" }}>
            Drag a marker or select it and use{" "}
            <kbd
              style={{
                padding: "0.1rem 0.35rem",
                borderRadius: "3px",
                border: "1px solid var(--line)",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
              }}
            >
              ←
            </kbd>{" "}
            /{" "}
            <kbd
              style={{
                padding: "0.1rem 0.35rem",
                borderRadius: "3px",
                border: "1px solid var(--line)",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
              }}
            >
              →
            </kbd>{" "}
            arrow keys to shift its position.
          </p>

          {/* Number line visualization */}
          <div style={{ position: "relative", padding: "2rem 1rem", userSelect: "none" }}>
            {/* Horizontal axis */}
            <div
              style={{
                height: "4px",
                background: "var(--line)",
                width: "100%",
                position: "relative",
                top: "1rem",
                borderRadius: "9999px",
              }}
            />

            {/* Zero origin tick */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "4px",
                transform: "translateX(-50%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div style={{ width: "2px", height: "1.75rem", background: "var(--ink)" }} />
              <span
                className="fine"
                style={{ fontFamily: "var(--font-mono)", fontWeight: 600, marginTop: "0.25rem" }}
              >
                0 (start)
              </span>
            </div>

            {/* Scale ticks from -8 to +8 */}
            {[-8, -6, -4, -2, 2, 4, 6, 8].map((val) => {
              const leftPercent = ((val + 8) / 16) * 100;
              return (
                <div
                  key={`tick-${val}`}
                  style={{
                    position: "absolute",
                    top: "8px",
                    left: `${leftPercent}%`,
                    transform: "translateX(-50%)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    pointerEvents: "none",
                  }}
                >
                  <div style={{ width: "1px", height: "1.25rem", background: "var(--line)" }} />
                  <span
                    className="fine"
                    style={{
                      fontSize: "10px",
                      fontFamily: "var(--font-mono)",
                      marginTop: "0.5rem",
                    }}
                  >
                    {val}
                  </span>
                </div>
              );
            })}

            {/* Interactive Particle Markers */}
            <div ref={trackRef} style={{ position: "relative", height: "3rem" }}>
              {particleItems.map((item) => {
                const pos = item.position;
                const idx = item.index;
                const leftPercent = Math.max(0, Math.min(100, ((pos + 8) / 16) * 100));
                const particleStyles = [
                  {
                    background: "var(--panel)",
                    color: "var(--ink)",
                    border: "2px solid var(--accent)",
                  },
                  {
                    background: "var(--wash)",
                    color: "var(--ink)",
                    border: "2px solid var(--line)",
                  },
                  {
                    background: "var(--accent)",
                    color: "var(--paper)",
                    border: "2px solid var(--accent)",
                  },
                  {
                    background: "var(--ink)",
                    color: "var(--paper)",
                    border: "2px solid var(--ink)",
                  },
                ];
                const markerStyle = particleStyles[idx % particleStyles.length] ??
                  particleStyles[0] ?? {
                    background: "var(--panel)",
                    color: "var(--ink)",
                    border: "2px solid var(--accent)",
                  };

                return (
                  <div
                    key={item.key}
                    tabIndex={0}
                    role="slider"
                    aria-label={`Particle ${idx + 1} displacement: ${formatSignedDisplacement(pos)} units`}
                    aria-valuenow={pos}
                    aria-valuemin={-8}
                    aria-valuemax={8}
                    onPointerDown={(e) => handlePointerDown(idx, e)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowLeft") {
                        e.preventDefault();
                        updateEntry(idx, pos - 1);
                      } else if (e.key === "ArrowRight") {
                        e.preventDefault();
                        updateEntry(idx, pos + 1);
                      } else if (e.key === "Home") {
                        e.preventDefault();
                        updateEntry(idx, -8);
                      } else if (e.key === "End") {
                        e.preventDefault();
                        updateEntry(idx, 8);
                      }
                    }}
                    style={{
                      position: "absolute",
                      left: `${leftPercent}%`,
                      transform: "translateX(-50%)",
                      top: 0,
                      cursor: "ew-resize",
                      touchAction: "none",
                      borderRadius: "50%",
                      width: "2rem",
                      height: "2rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.75rem",
                      fontWeight: "bold",
                      color: markerStyle.color,
                      backgroundColor: markerStyle.background,
                      border: markerStyle.border,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    }}
                  >
                    {idx + 1}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="input-grid" style={{ marginTop: "0.5rem", paddingTop: "0.5rem" }}>
            {particleItems.map((item) => (
              <div key={item.key} className="input-field" style={{ textAlign: "center" }}>
                <span className="fine" style={{ display: "block" }}>
                  Particle {item.index + 1}
                </span>
                <span
                  style={{ display: "block", fontFamily: "var(--font-mono)", fontWeight: "bold" }}
                >
                  {formatSignedDisplacement(item.position)} <span className="fine">units</span>
                </span>
                <span className="fine" style={{ display: "block" }}>
                  ({describeDisplacementInWords(item.position)})
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <section
          className="table-scroll"
          style={{ marginBottom: "1.5rem" }}
          aria-label="Particle displacements and squares table"
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Particle</th>
                <th scope="col">Word Description</th>
                <th scope="col" style={{ textAlign: "center" }}>
                  Displacement (x)
                </th>
                <th scope="col" style={{ textAlign: "center" }}>
                  Absolute (|x|)
                </th>
                <th scope="col" style={{ textAlign: "center" }}>
                  Squared (x²)
                </th>
              </tr>
            </thead>
            <tbody>
              {particleItems.map((item) => {
                const val = item.position;
                const i = item.index;
                return (
                  <tr key={item.key}>
                    <td style={{ fontFamily: "var(--font-mono)" }}>Particle {i + 1}</td>
                    <td>{describeDisplacementInWords(val)}</td>
                    <td style={{ textAlign: "center" }}>
                      <div
                        className="button-group"
                        style={{ justifyContent: "center", alignItems: "center" }}
                      >
                        <button
                          type="button"
                          aria-label={`Decrease Particle ${i + 1} displacement`}
                          onClick={() => updateEntry(i, val - 1)}
                          className="button secondary"
                          style={{ minHeight: "32px", padding: "0.2rem 0.6rem" }}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          aria-label={`Particle ${i + 1} displacement value`}
                          value={val}
                          onChange={(e) => {
                            const n = parseInt(e.target.value, 10);
                            if (!Number.isNaN(n)) updateEntry(i, n);
                          }}
                          style={{
                            width: "4.5rem",
                            textAlign: "center",
                            minHeight: "32px",
                            padding: "0.2rem",
                          }}
                        />
                        <button
                          type="button"
                          aria-label={`Increase Particle ${i + 1} displacement`}
                          onClick={() => updateEntry(i, val + 1)}
                          className="button secondary"
                          style={{ minHeight: "32px", padding: "0.2rem 0.6rem" }}
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td style={{ textAlign: "center", fontFamily: "var(--font-mono)" }}>
                      {Math.abs(val)} units
                    </td>
                    <td style={{ textAlign: "center", fontFamily: "var(--font-mono)" }}>
                      {val * val} sq units
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* Totals & Arithmetic Engine Output */}
      <div className="input-grid" style={{ marginBottom: "1.5rem" }}>
        <div className="notice">
          <span className="fine" style={{ display: "block", fontFamily: "var(--font-mono)" }}>
            Signed Total (Sum)
          </span>
          <span
            data-testid="totals-signed-sum"
            style={{
              display: "block",
              fontSize: "1.25rem",
              fontWeight: "bold",
              fontFamily: "var(--font-mono)",
              marginTop: "0.125rem",
            }}
          >
            {formatSignedDisplacement(totals.signedSum)} <span className="fine">units</span>
          </span>
          <span className="fine" style={{ display: "block", marginTop: "0.25rem" }}>
            Mean: {totals.meanSigned.toFixed(1)} units
          </span>
        </div>

        <div className="notice">
          <span className="fine" style={{ display: "block", fontFamily: "var(--font-mono)" }}>
            Mean Absolute (|x|)
          </span>
          <span
            data-testid="totals-mean-absolute"
            style={{
              display: "block",
              fontSize: "1.25rem",
              fontWeight: "bold",
              fontFamily: "var(--font-mono)",
              marginTop: "0.125rem",
              color: "var(--accent)",
            }}
          >
            {totals.meanAbsolute.toFixed(2)} <span className="fine">units</span>
          </span>
          <span className="fine" style={{ display: "block", marginTop: "0.25rem" }}>
            Proposal A (ignore sign)
          </span>
        </div>

        <div className="notice">
          <span className="fine" style={{ display: "block", fontFamily: "var(--font-mono)" }}>
            Mean Square (x²)
          </span>
          <span
            data-testid="totals-mean-square"
            style={{
              display: "block",
              fontSize: "1.25rem",
              fontWeight: "bold",
              fontFamily: "var(--font-mono)",
              marginTop: "0.125rem",
              color: "var(--accent)",
            }}
          >
            {totals.meanSquare.toFixed(2)} <span className="fine">sq units</span>
          </span>
          <span className="fine" style={{ display: "block", marginTop: "0.25rem" }}>
            Proposal B (square first)
          </span>
        </div>

        <div className="notice">
          <span className="fine" style={{ display: "block", fontFamily: "var(--font-mono)" }}>
            Root Mean Square (RMS)
          </span>
          <span
            data-testid="totals-rms"
            style={{
              display: "block",
              fontSize: "1.25rem",
              fontWeight: "bold",
              fontFamily: "var(--font-mono)",
              marginTop: "0.125rem",
            }}
          >
            {totals.rootMeanSquare.toFixed(3)} <span className="fine">units</span>
          </span>
          <span className="fine" style={{ display: "block", marginTop: "0.25rem" }}>
            √(Mean Square)
          </span>
        </div>
      </div>

      {/* Ten-step narrative guidance */}
      <div className="reading">
        <section>
          <h4>Step 2 & 3 · What a signed sum tells us</h4>
          <p>When we add the displacements algebraically, opposite directions cancel out:</p>
          <section
            className="formula"
            style={{ textAlign: "center", fontFamily: "var(--font-mono)" }}
            aria-label="Signed sum of displacements"
          >
            {entries.map((x) => `(${formatSignedDisplacement(x)})`).join(" + ")} ={" "}
            <strong>{formatSignedDisplacement(totals.signedSum)} units</strong>
          </section>
          <p>
            A signed total of zero tells us that the average endpoint has not shifted. It does not
            mean every particle remained at rest. In the authored example all four particles have
            nonzero displacements; after your edits the displayed totals describe your chosen
            endpoints.
          </p>
        </section>

        <section>
          <h4>Step 4 & 5 · Two sensible proposals to keep information about distance</h4>
          <p>
            How do we keep track of how far particles wandered without opposite directions
            cancelling out? Both of the following proposals are completely sensible:
          </p>
          <ul>
            <li>
              <strong>Proposal A (Ignore the direction):</strong> Take the absolute value of each
              displacement. For our authored example (−3, −1, +1, +3), the absolute values are 3, 1,
              1, 3 units, giving a mean absolute displacement of <strong>2 units</strong>.
            </li>
            <li>
              <strong>Proposal B (Square each displacement):</strong> Multiplying any negative
              number by itself produces a positive number. The squared displacements are 9, 1, 1, 9
              squared units, giving a mean square displacement of <strong>5 squared units</strong>{" "}
              (and an RMS distance of √5 ≈ <strong>2.236 units</strong>).
            </li>
          </ul>
        </section>

        <section>
          <h4>Step 6 & 7 · Scaling: What happens when displacements double?</h4>
          <p>
            Suppose after a longer interval every particle has wandered twice as far (−6, −2, +2, +6
            units):
          </p>
          <div className="input-grid">
            <div className="notice">
              <span className="fine" style={{ display: "block" }}>
                Mean Absolute Displacement:
              </span>
              <strong style={{ fontFamily: "var(--font-mono)" }}>
                (|-6| + |-2| + |+2| + |+6|) / 4 = 4 units
              </strong>{" "}
              (doubles from 2)
            </div>
            <div className="notice">
              <span className="fine" style={{ display: "block" }}>
                Mean Square Displacement:
              </span>
              <strong style={{ fontFamily: "var(--font-mono)" }}>
                (36 + 4 + 4 + 36) / 4 = 20 sq units
              </strong>{" "}
              (quadruples from 5)
            </div>
          </div>
          <p>
            Notice that when displacement distances double, the mean square quadruples (2² = 4 times
            larger), and its square root (RMS = √20 ≈ 4.472 units) doubles exactly in proportion to
            distance.
          </p>
        </section>

        <section>
          <h4>Step 8 · Why the mean square has a simple additive rule</h4>
          <p>
            Both proposals measure spread. The mean square has a useful property when independent,
            zero-mean displacements are added. This is a pedagogical bridge, not the paper’s printed
            calculation.
          </p>
          <p>
            First expand the square of a sum. This algebra holds without an independence assumption:
          </p>
          <section
            className="formula"
            style={{ textAlign: "center", fontFamily: "var(--font-mono)" }}
            aria-label="Square of sum expansion formula"
          >
            (Δx₁ + Δx₂)² = Δx₁² + 2·Δx₁·Δx₂ + Δx₂²
          </section>
          <p>
            Now assume the displacements over the chosen time intervals are independent and each has
            zero mean. Independence makes the average product equal the product of the averages, so
            the cross term vanishes on averaging, not in every outcome. Equal finite step mean
            squares then add in proportion to the number of intervals. This coarse-grained
            assumption is not a claim about molecular motion at arbitrarily short times.
          </p>
          <p>
            Absolute values do not possess this mathematical linearity when steps are added
            together, which is why mean square has a particularly simple additive calculation.
          </p>
        </section>

        <section>
          <h4>Step 9 · Mean absolute displacement is not a wrong answer</h4>
          <p>
            Mean absolute displacement is <strong>not</strong> an incorrect calculation. It answers
            a slightly different question about the average absolute net displacement from the
            starting point and, in the ideal Gaussian distribution, it scales directly with the
            square root of time (equal to √(4Dt/π) along one coordinate).
          </p>
        </section>
      </div>

      {/* Collapsible details: Why the square is useful */}
      <div className="notice" style={{ margin: "1.5rem 0" }}>
        <button
          type="button"
          onClick={() => setShowWhySquare((v) => !v)}
          className="button secondary"
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>Why the square is useful: a two-step algebraic demonstration</span>
          <span className="fine">{showWhySquare ? "Hide ▲" : "Show ▼"}</span>
        </button>
        {showWhySquare && (
          <div style={{ marginTop: "1rem", fontSize: "0.95rem" }}>
            <p>
              Consider two successive independent steps Δx₁ and Δx₂, each equally likely to be +1 or
              −1:
            </p>
            <ul style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>
              <li>Possibility 1: (+1, +1) → Total = +2, Squared = 4</li>
              <li>Possibility 2: (+1, −1) → Total = 0, Squared = 0</li>
              <li>Possibility 3: (−1, +1) → Total = 0, Squared = 0</li>
              <li>Possibility 4: (−1, −1) → Total = −2, Squared = 4</li>
            </ul>
            <p>
              The average total displacement is (2 + 0 + 0 − 2)/4 = <strong>0</strong>. The average
              squared displacement is (4 + 0 + 0 + 4)/4 = <strong>2</strong> (exactly 1² + 1²). The
              cross term (+2, −2, −2, +2) summed to zero!
            </p>
          </div>
        )}
      </div>

      <p>
        <a href="/papers/brownian-motion/s4/?open=derivation-step:bm-variance-cross#arg-bm-independent-steps">
          Why do the cross terms vanish? Open the exact missing step
        </a>
      </p>

      {/* Step 10 · The Bridge */}
      <footer
        style={{ borderTop: "2px solid var(--line)", paddingTop: "1.5rem", marginTop: "2rem" }}
      >
        <span className="eyebrow" style={{ display: "block", marginBottom: "0.5rem" }}>
          Step 10 · The bridge to the argument
        </span>

        {/* 3 required bridge parts */}
        <div className="notice" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <h5 className="eyebrow">New skill</h5>
            <p style={{ margin: "0.25rem 0 0" }}>
              {record?.bridge?.newSkill ??
                "keeping track of how far things went by squaring, so opposite directions stop cancelling."}
            </p>
          </div>

          <div>
            <h5 className="eyebrow">Why useful in the paper</h5>
            <p style={{ margin: "0.25rem 0 0" }}>
              {record?.bridge?.whyUsefulHere ??
                "Section 5 says how far a particle typically wanders after a given time, and that statement is about the squared spread, not about a speed."}
            </p>
          </div>

          <div>
            <h5 className="eyebrow" style={{ marginBottom: "0.5rem" }}>
              Continue with your choice of guidance
            </h5>
            <div className="input-grid">
              {/* More Guidance Route */}
              <div
                className="input-field"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <span className="eyebrow" style={{ display: "block", marginBottom: "0.25rem" }}>
                    More guidance · Foundations
                  </span>
                  <p className="fine" style={{ marginBottom: "0.75rem" }}>
                    Review mean, variance, and root-mean-square displacement with worked algebraic
                    examples in the Foundations library.
                  </p>
                </div>
                <a
                  href="/foundations/mean-variance-rms"
                  onClick={(e) => {
                    if (onNavigateFoundation) {
                      e.preventDefault();
                      onNavigateFoundation("mean-variance-rms");
                    }
                  }}
                  className="button secondary"
                >
                  Open the mean, variance and RMS drawer
                </a>
              </div>

              {/* Less Guidance Route */}
              <div
                className="input-field"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <span className="eyebrow" style={{ display: "block", marginBottom: "0.25rem" }}>
                    Less guidance · Laboratory & paper
                  </span>
                  <p className="fine" style={{ marginBottom: "0.75rem" }}>
                    Test thousands of particles in the tracer-ensemble laboratory or jump straight
                    to Einstein’s §5 displacement passage.
                  </p>
                </div>
                <div className="button-group">
                  <a
                    href="/lab/bm-01"
                    data-instrument-id="bm-01"
                    onClick={(e) => {
                      if (onNavigateInstrument) {
                        e.preventDefault();
                        onNavigateInstrument("bm-01");
                      }
                    }}
                    className="button"
                  >
                    Open the tracer-ensemble laboratory
                  </a>
                  <a href="/papers/brownian-motion/s5/#s5-p1-s1" className="button secondary">
                    Go to the §5 passage
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Complete No-JavaScript Fallback */}
      <noscript>
        <div className="notice" style={{ marginTop: "2rem" }}>
          <h4>Static reference (JavaScript disabled)</h4>
          <p className="fine" style={{ marginBottom: "1rem" }}>
            With JavaScript disabled, the complete worked arithmetic is presented statically below:
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              fontFamily: "var(--font-mono)",
              fontSize: "0.85rem",
            }}
          >
            <div className="notice">
              <strong>Authored Example (−3, −1, +1, +3 units):</strong>
              <br />
              Signed sum = (−3) + (−1) + (+1) + (+3) = 0 units.
              <br />
              Mean absolute displacement = (3 + 1 + 1 + 3) / 4 = 2 units.
              <br />
              Mean square displacement = (9 + 1 + 1 + 9) / 4 = 5 sq units.
              <br />
              Root-mean-square displacement (RMS) = √5 ≈ 2.236 units.
            </div>
            <div className="notice">
              <strong>Doubled Example (−6, −2, +2, +6 units):</strong>
              <br />
              Signed sum = (−6) + (−2) + (+2) + (+6) = 0 units.
              <br />
              Mean absolute displacement = (6 + 2 + 2 + 6) / 4 = 4 units.
              <br />
              Mean square displacement = (36 + 4 + 4 + 36) / 4 = 20 sq units.
              <br />
              Root-mean-square displacement (RMS) = √20 ≈ 4.472 units.
            </div>
          </div>
          <div className="button-group" style={{ marginTop: "1rem" }}>
            <a href="/foundations/mean-variance-rms" className="button secondary">
              Open the foundation on mean, variance and RMS
            </a>
            <a href="/lab/bm-01" className="button secondary">
              Open the tracer-ensemble laboratory
            </a>
            <a href="/papers/brownian-motion/s5/#s5-p1-s1" className="button secondary">
              Go to the §5 displacement passage
            </a>
          </div>
        </div>
      </noscript>
    </div>
  );
}
