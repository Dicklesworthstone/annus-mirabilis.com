import type { Metadata } from "next";
import { FluorescenceLab } from "../../../components/lab/lq07/FluorescenceLab.tsx";
import { LQ07_DEFAULTS } from "../../../experiments/lq07/definition.ts";
import { evaluateLq07, type PreparedLq07Example } from "../../../experiments/lq07/session.ts";

export const metadata: Metadata = {
  title: "Fluorescence energy budget and Stokes's rule",
  description:
    "Single-quantum energy conservation hν₁ = hν₂ + E_other explains Stokes's rule and sets the conditions for multi-quantum and thermal deviations in Einstein's 1905 paper.",
};

export default function FluorescencePage() {
  const evalResult = evaluateLq07(LQ07_DEFAULTS);
  const example: PreparedLq07Example = {
    sourceDigest: "src/physics/reference/photoelectric.ts",
    parameters: LQ07_DEFAULTS,
    results: evalResult.outputs.map(
      (o) => `${o.quantityId}=${o.status === "value" ? String(o.value) : o.status}`,
    ),
    stepIndex: 1,
    simulationTime: 1.0,
  };

  return (
    <main
      style={{
        maxWidth: "64rem",
        margin: "0 auto",
        padding: "2rem 1rem",
      }}
    >
      <header className="page-intro" style={{ marginBottom: "1.5rem", textAlign: "center" }}>
        <p className="eyebrow" style={{ marginBottom: "0.25rem" }}>
          LQ-07 · Light quanta · Paper 1, §7 energy conservation
        </p>
        <h1 style={{ fontFamily: "var(--font-serif, serif)" }}>
          Stokes's rule and the single-quantum energy budget
        </h1>
        <p className="lead" style={{ maxWidth: "42rem", margin: "0.5rem auto 0" }}>
          Why the frequency of emitted fluorescent light cannot exceed that of the exciting light
          under elementary quantum transformation, and how Einstein deduced the exact conditions for
          exceptions.
        </p>
      </header>

      <FluorescenceLab example={example} />

      <section
        id="fluorescence-argument"
        className="reading"
        style={{
          marginTop: "3rem",
          borderTop: "1px solid var(--line)",
          paddingTop: "2rem",
          maxWidth: "48rem",
          margin: "3rem auto 0",
        }}
      >
        <h2 style={{ fontFamily: "var(--font-serif, serif)" }}>
          The single-quantum energy budget in Einstein 1905 §7
        </h2>
        <p>
          In 1852, George Gabriel Stokes formulated the empirical rule that fluorescent light always
          has a lower frequency (longer wavelength) than the light that excited it. In §7 of his
          1905 paper, Einstein showed that this rule is an immediate consequence of the
          light-quantum hypothesis:
        </p>
        <blockquote
          style={{
            borderLeft: "2px solid var(--accent)",
            paddingLeft: "1rem",
            margin: "0.75rem 0",
            fontSize: "0.875rem",
            fontStyle: "italic",
            color: "var(--muted)",
          }}
        >
          &ldquo;If monochromatic light of frequency ν₁ is transformed into light of frequency ν₂ by
          photoluminescence, and if the process occurs such that one absorbed quantum is converted
          into one emitted quantum plus non-optical energy... then the energy of the emitted quantum
          cannot be greater than that of the exciting one.&rdquo;
        </blockquote>
        <div
          style={{
            padding: "1rem",
            background: "var(--wash)",
            border: "1px solid var(--line)",
            borderRadius: "0.5rem",
            textAlign: "center",
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "0.875rem",
            fontWeight: "bold",
            margin: "1rem 0",
          }}
        >
          hν₁ = hν₂ + E_other &emsp;(E_other ≥ 0) &emsp;&Longrightarrow;&emsp; ν₂ ≤ ν₁
        </div>

        <h3 style={{ fontFamily: "var(--font-serif, serif)", paddingTop: "0.5rem" }}>
          The two historical deviation cases
        </h3>
        <p>
          Rather than stating Stokes's rule as an unbreakable law, Einstein explicitly deduced the
          physical conditions under which anti-Stokes emission (ν₂ &gt; ν₁) can occur:
        </p>
        <ul style={{ paddingLeft: "1.25rem", listStyleType: "disc" }}>
          <li style={{ marginBottom: "0.5rem" }}>
            <strong>Deviation Case 1 (Multi-quantum absorption):</strong> If the elementary process
            involves the simultaneous absorption of{" "}
            <span style={{ fontStyle: "italic", fontWeight: 600 }}>k</span> light quanta, the
            available energy is{" "}
            <code style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: 600 }}>
              k hν₁
            </code>
            , permitting emission up to{" "}
            <code style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: 600 }}>
              ν₂ ≤ k ν₁
            </code>
            .
          </li>
          <li style={{ marginBottom: "0.5rem" }}>
            <strong>Deviation Case 2 (Non-Wien exciting radiation):</strong> If the incident light
            is not in the Wien regime (where the light-quantum volume law was derived),
            single-quantum behavior is not guaranteed.
          </li>
        </ul>

        <div style={{ paddingTop: "1rem" }}>
          <a
            href="/papers/light-quanta#s7"
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--accent)",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
            }}
          >
            Read the original German source text and translation for §7
          </a>
        </div>
      </section>
    </main>
  );
}
