"use client";

import { useId, useState } from "react";
import { LN_2, LOG10_2 } from "../../foundations/calculus.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

export interface LogarithmPair {
  readonly w1: number;
  readonly w2: number;
  readonly product: number;
  readonly lnW1: number;
  readonly lnW2: number;
  readonly lnProduct: number;
}

export const LOG_PAIRS: readonly LogarithmPair[] = [
  {
    w1: 2,
    w2: 4,
    product: 8,
    lnW1: Math.log(2),
    lnW2: Math.log(4),
    lnProduct: Math.log(8),
  },
  {
    w1: 3,
    w2: 5,
    product: 15,
    lnW1: Math.log(3),
    lnW2: Math.log(5),
    lnProduct: Math.log(15),
  },
  {
    w1: 10,
    w2: 10,
    product: 100,
    lnW1: Math.log(10),
    lnW2: Math.log(10),
    lnProduct: Math.log(100),
  },
];

export type NotationMode = "modern-iso" | "annalen-1905";

/**
 * Interactive product-to-sum table for foundation:logarithms.
 * Demonstrates how logarithms turn multiplied state counts into added entropies,
 * and provides an interactive toggle between modern ISO 'ln' and 1905 Annalen 'lg' notation.
 */
export function LogarithmProductTable({
  headingLevel = 3,
}: {
  readonly headingLevel?: HeadingLevel;
}) {
  const headingId = useId(),
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);
  const [notationMode, setNotationMode] = useState<NotationMode>("modern-iso");

  const isAnnalen = notationMode === "annalen-1905";
  const logSymbol = isAnnalen ? "lg" : "ln";

  return (
    <section
      className="foundation-construction logarithm-product-table"
      aria-labelledby={headingId}
      data-foundation-construction="logarithms"
    >
      <Title id={headingId} className="construction-title">
        Interactive construction: turning multiplication into addition
      </Title>
      <p>
        In section 5 of the light-quanta paper, Einstein reasons about the entropy S of independent
        systems. When two independent systems with microstate counts W₁ and W₂ are combined, the
        total number of configurations multiplies: W = W₁ · W₂. However, the thermodynamic entropy
        must add: S = S₁ + S₂. The only continuous function satisfying φ(W₁ · W₂) = φ(W₁) + φ(W₂) is
        the logarithm: S = k ln W + const.
      </p>

      <div className="notation-toggle-controls" style={{ margin: "1rem 0" }}>
        <p style={{ fontWeight: "bold", margin: "0.5rem 0" }}>Notation display toggle:</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => setNotationMode(isAnnalen ? "modern-iso" : "annalen-1905")}
            aria-pressed={isAnnalen}
            style={{
              padding: "0.5rem 1rem",
              border: "1px solid var(--rule)",
              borderRadius: "4px",
              background: isAnnalen ? "var(--accent)" : "var(--paper)",
              color: isAnnalen ? "var(--paper)" : "var(--ink)",
              cursor: "pointer",
            }}
          >
            {isAnnalen
              ? "Notation: 1905 Annalen der Physik (lg = natural log)"
              : "Notation: Modern ISO standard (ln = natural log)"}
          </button>
          <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
            Click or press Enter to toggle between 1905 historical print and modern ISO symbols.
          </span>
        </div>
      </div>

      <div
        className="notation-callout"
        style={{
          border: "1px solid var(--rule)",
          borderRadius: "4px",
          padding: "1rem",
          background: "var(--paper)",
          margin: "1rem 0",
        }}
      >
        <Sub style={{ margin: "0 0 0.5rem 0" }}>
          1905 historical notation vs Modern ISO standard
        </Sub>
        <p style={{ margin: "0.3rem 0" }}>
          In 1905 German scientific printing (including <em>Annalen der Physik</em>), the symbol{" "}
          <strong>lg</strong> denoted the <strong>natural logarithm</strong> (base e).
        </p>
        <p style={{ margin: "0.3rem 0" }}>
          In modern ISO 80000-2 notation, <strong>ln</strong> denotes the natural logarithm, while{" "}
          <strong>lg</strong> is reserved for the common base-10 logarithm (log₁₀).
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "0.3rem 1.5rem",
            marginTop: "0.5rem",
            fontFamily: "var(--font-mono, monospace)",
          }}
        >
          <span>1905 printed “lg 2”:</span>
          <span style={{ color: "var(--accent)", fontWeight: "bold" }}>
            {LN_2.toFixed(6)} (natural logarithm ln 2)
          </span>

          <span>Modern ISO “lg 2” (log₁₀ 2):</span>
          <span style={{ color: "var(--muted)" }}>
            {LOG10_2.toFixed(6)} (common base-10 logarithm)
          </span>
        </div>
      </div>

      <section
        className="construction-table-wrap"
        style={{ marginTop: "1rem" }}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a region that scrolls must be focusable or its off-screen columns are unreachable by keyboard, which is the access defect the scroll container would otherwise introduce (am-bc6s). Suppressed inline at the site, following ModernOnlySymbolsView.tsx, rather than as a per-file override that turns the rule off for a whole file and carries no reason with it.
        tabIndex={0}
        aria-label="Verification of the logarithmic product-to-sum identity, scrollable table"
      >
        <table
          className="data-table"
          style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}
        >
          <caption style={{ textAlign: "left", fontWeight: "bold", marginBottom: "0.5rem" }}>
            Verification of logarithmic product-to-sum identity: {logSymbol}(W₁ · W₂) = {logSymbol}
            (W₁) + {logSymbol}(W₂)
          </caption>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--rule)", textAlign: "left" }}>
              <th scope="col" style={{ padding: "0.4rem" }}>
                State W₁
              </th>
              <th scope="col" style={{ padding: "0.4rem" }}>
                State W₂
              </th>
              <th scope="col" style={{ padding: "0.4rem" }}>
                Product W₁ · W₂
              </th>
              <th scope="col" style={{ padding: "0.4rem" }}>
                {logSymbol}(W₁)
              </th>
              <th scope="col" style={{ padding: "0.4rem" }}>
                {logSymbol}(W₂)
              </th>
              <th scope="col" style={{ padding: "0.4rem" }}>
                Sum {logSymbol}(W₁) + {logSymbol}(W₂)
              </th>
              <th scope="col" style={{ padding: "0.4rem" }}>
                {logSymbol}(W₁ · W₂)
              </th>
            </tr>
          </thead>
          <tbody>
            {LOG_PAIRS.map((pair) => (
              <tr key={`${pair.w1}-${pair.w2}`} style={{ borderBottom: "1px solid var(--rule)" }}>
                <td style={{ padding: "0.4rem" }}>{pair.w1}</td>
                <td style={{ padding: "0.4rem" }}>{pair.w2}</td>
                <td style={{ padding: "0.4rem" }}>{pair.product}</td>
                <td style={{ padding: "0.4rem", fontFamily: "var(--font-mono, monospace)" }}>
                  {pair.lnW1.toFixed(6)}
                </td>
                <td style={{ padding: "0.4rem", fontFamily: "var(--font-mono, monospace)" }}>
                  {pair.lnW2.toFixed(6)}
                </td>
                <td
                  style={{
                    padding: "0.4rem",
                    fontFamily: "var(--font-mono, monospace)",
                    fontWeight: "bold",
                  }}
                >
                  {(pair.lnW1 + pair.lnW2).toFixed(6)}
                </td>
                <td
                  style={{
                    padding: "0.4rem",
                    fontFamily: "var(--font-mono, monospace)",
                    color: "var(--accent)",
                  }}
                >
                  {pair.lnProduct.toFixed(6)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div
        className="construction-text-equivalent"
        style={{ fontSize: "0.9rem", marginTop: "1rem" }}
      >
        <Sub>Textual summary of the construction</Sub>
        <p>
          The table demonstrates that for any pair of numbers, the logarithm of their product
          exactly equals the sum of their individual logarithms. This algebraic homomorphism bridges
          statistical mechanics (where independent configurations multiply) and macroscopic
          thermodynamics (where entropy is an extensive, additive quantity). When reading 1905
          papers, readers must translate printed “lg” to natural “ln” to obtain the correct physical
          entropies.
        </p>
      </div>
    </section>
  );
}
