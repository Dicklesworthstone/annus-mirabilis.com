"use client";

import { useState } from "react";

export type HeldFixedMode = "time-fixed" | "position-fixed";

/**
 * Interactive held-fixed toggle construction for foundation:partial-derivatives.
 * Demonstrates the two distinct partial derivatives of particle density c(x, t) in Brownian motion,
 * explicitly contrasting what is held fixed and comparing to thermodynamic constraints.
 */
export function HeldFixedToggle() {
  const [activeMode, setActiveMode] = useState<HeldFixedMode>("time-fixed");

  return (
    <section
      className="foundation-construction held-fixed-toggle"
      aria-labelledby="construction-held-fixed-heading"
      data-foundation-construction="partial-derivatives"
    >
      <h3 id="construction-held-fixed-heading">
        Interactive construction: what is held fixed in a partial derivative
      </h3>
      <p>
        In sections 3 and 4 of the Brownian motion paper, Einstein tracks the concentration of
        suspended particles c(x, t) as a function of both position x along a tube and elapsed time
        t. Because two independent variables can change, asking for “the rate of change of
        concentration” is ambiguous until you specify which coordinate is held fixed.
      </p>

      <fieldset
        className="toggle-controls"
        aria-label="Coordinate held fixed selector"
        style={{ border: "none", padding: 0, margin: "1rem 0" }}
      >
        <p style={{ fontWeight: "bold", margin: "0.5rem 0" }}>
          Choose which coordinate to hold fixed:
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={() => setActiveMode("time-fixed")}
            aria-pressed={activeMode === "time-fixed"}
            style={{
              padding: "0.5rem 1rem",
              border: "1px solid var(--rule)",
              borderRadius: "4px",
              background: activeMode === "time-fixed" ? "var(--accent)" : "var(--paper)",
              color: activeMode === "time-fixed" ? "var(--paper)" : "var(--ink)",
              cursor: "pointer",
            }}
          >
            Hold time t fixed: Spatial derivative ∂c/∂x
          </button>
          <button
            type="button"
            onClick={() => setActiveMode("position-fixed")}
            aria-pressed={activeMode === "position-fixed"}
            style={{
              padding: "0.5rem 1rem",
              border: "1px solid var(--rule)",
              borderRadius: "4px",
              background: activeMode === "position-fixed" ? "var(--accent)" : "var(--paper)",
              color: activeMode === "position-fixed" ? "var(--paper)" : "var(--ink)",
              cursor: "pointer",
            }}
          >
            Hold position x fixed: Time derivative ∂c/∂t
          </button>
        </div>
      </fieldset>

      <div
        className="held-fixed-display"
        style={{
          border: "1px solid var(--rule)",
          borderRadius: "4px",
          padding: "1.2rem",
          background: "var(--paper)",
          margin: "1rem 0",
        }}
      >
        {activeMode === "time-fixed" ? (
          <div>
            <h4 style={{ margin: "0 0 0.5rem 0", color: "var(--accent)" }}>
              Case A: Hold time t fixed (∂c / ∂x)
            </h4>
            <p>
              <strong>Quantity held fixed:</strong> Time t (a single snapshot across the tube).
            </p>
            <p>
              <strong>Meaning:</strong> Spatial concentration gradient. You inspect different
              positions along the tube at one frozen instant.
            </p>
            <p>
              <strong>Physical units:</strong> particles / (µm³ · µm) = particles / µm⁴.
            </p>
            <p>
              <strong>Role in Brownian motion:</strong> Fick’s first law of diffusion states that
              the particle flux is proportional to this spatial gradient: J = −D (∂c/∂x).
            </p>
          </div>
        ) : (
          <div>
            <h4 style={{ margin: "0 0 0.5rem 0", color: "var(--accent)" }}>
              Case B: Hold position x fixed (∂c / ∂t)
            </h4>
            <p>
              <strong>Quantity held fixed:</strong> Position x (a single point under the
              microscope).
            </p>
            <p>
              <strong>Meaning:</strong> Local accumulation rate over time. You monitor one fixed
              spot and count how fast the particle count rises or falls.
            </p>
            <p>
              <strong>Physical units:</strong> particles / (µm³ · s).
            </p>
            <p>
              <strong>Role in Brownian motion:</strong> Conservation of matter (the continuity
              equation) equates this rate to the divergence of flux: ∂c/∂t = −∂J/∂x = D (∂²c/∂x²).
            </p>
          </div>
        )}
      </div>

      {/*
        am-a3f1. The four sibling foundations components wrap their tables in
        construction-table-wrap; this one did not, and its table is the widest of them. Its
        columns need 350.3px, which does not fit a 320px viewport at any panel padding - measured,
        after a padding-only route was tried and could not reach it - so this region genuinely
        scrolls and the scroll is structurally required rather than a choice someone made.

        The tab stop ships with it rather than being left for later, for two reasons.
        construction-table-wrap is recorded in scrollableRegions' NOT_YET_AUDITED at 4 unreachable
        regions and that number may only shrink, so a fifth usage without one would have raised
        it. And a scroll container a keyboard cannot reach is a worse defect than the overflow it
        replaces, because the overflow still left the content reachable.
      */}
      <section
        className="thermodynamics-held-fixed-comparison construction-table-wrap"
        style={{ marginTop: "1.5rem" }}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a region that scrolls must be focusable or its off-screen columns are unreachable by keyboard, which is the access defect the scroll container would otherwise introduce (am-bc6s). Suppressed inline at the site, following ModernOnlySymbolsView.tsx, rather than as a per-file override that turns the rule off for a whole file and carries no reason with it.
        tabIndex={0}
        aria-label="Thermodynamic partial derivatives and their held-fixed constraints, scrollable table"
      >
        <h4>Thermodynamic examples: how the fixed constraint changes the derivative</h4>
        <p>
          In thermodynamics, the same symbols have completely different numerical values depending
          on what is held fixed:
        </p>
        <table
          className="data-table"
          style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}
        >
          <caption style={{ textAlign: "left", fontWeight: "bold", marginBottom: "0.5rem" }}>
            Thermodynamic partial derivatives and their held-fixed constraints
          </caption>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--rule)", textAlign: "left" }}>
              <th scope="col" style={{ padding: "0.4rem" }}>
                Process
              </th>
              <th scope="col" style={{ padding: "0.4rem" }}>
                Derivative
              </th>
              <th scope="col" style={{ padding: "0.4rem" }}>
                Quantity held fixed
              </th>
              <th scope="col" style={{ padding: "0.4rem" }}>
                Physical behavior
              </th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: "1px solid var(--rule)" }}>
              <td style={{ padding: "0.4rem" }}>
                <strong>Isothermal</strong>
              </td>
              <td style={{ padding: "0.4rem", fontFamily: "var(--font-mono, monospace)" }}>
                (∂p / ∂V)<sub>T</sub>
              </td>
              <td style={{ padding: "0.4rem" }}>Temperature T fixed</td>
              <td style={{ padding: "0.4rem" }}>
                Heat flows in or out to maintain constant temperature
              </td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--rule)" }}>
              <td style={{ padding: "0.4rem" }}>
                <strong>Adiabatic</strong>
              </td>
              <td style={{ padding: "0.4rem", fontFamily: "var(--font-mono, monospace)" }}>
                (∂p / ∂V)<sub>S</sub>
              </td>
              <td style={{ padding: "0.4rem" }}>Entropy S fixed (no heat exchange)</td>
              <td style={{ padding: "0.4rem" }}>
                Gas warms upon compression; stiffer response than isothermal
              </td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--rule)" }}>
              <td style={{ padding: "0.4rem" }}>
                <strong>Isochoric</strong>
              </td>
              <td style={{ padding: "0.4rem", fontFamily: "var(--font-mono, monospace)" }}>
                (∂p / ∂T)<sub>V</sub>
              </td>
              <td style={{ padding: "0.4rem" }}>Volume V fixed</td>
              <td style={{ padding: "0.4rem" }}>
                Rigid vessel; pressure rises directly with heating
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <div
        className="construction-text-equivalent"
        style={{ fontSize: "0.9rem", marginTop: "1rem" }}
      >
        <h4>Textual summary of the construction</h4>
        <p>
          Writing ∂c/∂x asserts that t is held constant during differentiation. Writing ∂c/∂t
          asserts that x is held constant during differentiation. These two operations describe
          different physical phenomena and carry different physical dimensions. In thermodynamics,
          the subscript notation (∂p/∂V)<sub>T</sub> versus (∂p/∂V)<sub>S</sub> makes this essential
          distinction visible on the page.
        </p>
      </div>
    </section>
  );
}
