import type { Metadata } from "next";
import { IndependentConfigurationsLab } from "../../../components/lab/lq05/IndependentConfigurationsLab.tsx";
import { LQ05_DEFAULTS } from "../../../experiments/lq05/definition.ts";
import { evaluateLq05, type PreparedLq05Example } from "../../../experiments/lq05/session.ts";

export const metadata: Metadata = {
  title: "Independent configurations and Boltzmann entropy",
  description:
    "Boltzmann's principle S - S_0 = k_B ln W gives an entropy that depends on volume as n ln V, and locking the positions shows where statistical independence enters.",
};

export default function IndependentConfigurationsPage() {
  const evalResult = evaluateLq05(LQ05_DEFAULTS);
  const example: PreparedLq05Example = {
    sourceDigest: "src/physics/reference/radiation/configurations.ts",
    parameters: LQ05_DEFAULTS,
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
          LQ-05 · Light quanta · Paper 1, §5 heuristic foundation
        </p>
        <h1 style={{ fontFamily: "var(--font-serif, serif)" }}>
          Independent configurations and the gas analogy
        </h1>
        <p className="lead" style={{ maxWidth: "42rem", margin: "0.5rem auto 0" }}>
          How counting independent configurations produces an entropy law depending on volume as n
          ln(V/V₀), matching Wien-regime radiation and establishing the heuristic light-quantum
          concept.
        </p>
      </header>

      <IndependentConfigurationsLab example={example} />

      <section
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
          The independence argument in Einstein 1905 §5
        </h2>
        <p>
          In §5 of the 1905 light-quanta paper, Einstein applies Boltzmann&apos;s principle{" "}
          <code style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: 600 }}>
            S − S₀ = (R/N) lg W
          </code>{" "}
          to an ideal gas of <span style={{ fontStyle: "italic", fontWeight: 600 }}>n</span> movable
          points in volume <span style={{ fontStyle: "italic", fontWeight: 600 }}>V₀</span>. If the
          points move independently with no favored position or direction, the statistical
          probability that all <span style={{ fontStyle: "italic", fontWeight: 600 }}>n</span>{" "}
          points are found in a subvolume{" "}
          <span style={{ fontStyle: "italic", fontWeight: 600 }}>V</span> is simply:
        </p>
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
          W = (V / V₀)ⁿ &emsp;&Longrightarrow;&emsp; S − S₀ = (R / N) n ln(V / V₀)
        </div>
        <p>
          Comparing this gas entropy with the monochromatic radiation entropy found in §4,{" "}
          <code style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: 600 }}>
            S − S₀ = (E / hν) k_B ln(V / V₀)
          </code>
          , leads directly to the conclusion: monochromatic radiation behaves energetically as if it
          consists of <span style={{ fontStyle: "italic", fontWeight: 600 }}>E / (hν)</span>{" "}
          independent energy quanta of magnitude{" "}
          <span style={{ fontStyle: "italic", fontWeight: 600 }}>hν</span>.
        </p>
        <div style={{ paddingTop: "0.5rem" }}>
          <a
            href="/papers/light-quanta#s5"
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--accent)",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
            }}
          >
            Read the original German source text and translation for §5
          </a>
        </div>
      </section>
    </main>
  );
}
