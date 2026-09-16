import type { Metadata } from "next";
import { IndependentConfigurationsLab } from "../../../components/lab/lq05/IndependentConfigurationsLab.tsx";
import { LQ05_DEFAULTS } from "../../../experiments/lq05/definition.ts";
import { evaluateLq05, type PreparedLq05Example } from "../../../experiments/lq05/session.ts";

export const metadata: Metadata = {
  title: "LQ-05: Independent Configurations & Boltzmann Entropy",
  description:
    "Explore how Boltzmann's principle S - S_0 = k_B ln W yields an entropy depending on volume as n ln V, and how locking the positions demonstrates the role of statistical independence.",
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
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      <header className="page-intro mb-6 text-center">
        <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">
          Light Quanta · Paper 1, §5 Heuristic Foundation
        </p>
        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-foreground">
          Independent Configurations and the Gas Analogy
        </h1>
        <p className="text-base text-muted-foreground mt-2 max-w-2xl mx-auto font-serif">
          How counting independent configurations produces an entropy law depending on volume as n
          ln(V/V₀), matching Wien-regime radiation and establishing the heuristic light-quantum
          concept.
        </p>
      </header>

      <IndependentConfigurationsLab example={example} />

      <section className="mt-12 border-t border-border/80 pt-8 max-w-3xl mx-auto space-y-4">
        <h2 className="text-xl font-serif font-bold text-foreground">
          The Independence Argument in Einstein 1905 §5
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          In §5 of the 1905 light-quanta paper, Einstein applies Boltzmann&apos;s principle{" "}
          <code className="font-mono text-foreground font-semibold">S − S₀ = (R/N) lg W</code> to an
          ideal gas of <span className="font-serif italic font-semibold">n</span> movable points in
          volume <span className="font-serif italic font-semibold">V₀</span>. If the points move
          independently with no favored position or direction, the statistical probability that all{" "}
          <span className="font-serif italic font-semibold">n</span> points are found in a subvolume{" "}
          <span className="font-serif italic font-semibold">V</span> is simply:
        </p>
        <div className="p-4 bg-muted/30 border border-border rounded-lg text-center font-mono text-sm font-bold my-4">
          W = (V / V₀)ⁿ &emsp;&Longrightarrow;&emsp; S − S₀ = (R / N) n ln(V / V₀)
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Comparing this gas entropy with the monochromatic radiation entropy found in §4,{" "}
          <code className="font-mono text-foreground font-semibold">
            S − S₀ = (E / hν) k_B ln(V / V₀)
          </code>
          , leads directly to the conclusion: monochromatic radiation behaves energetically as if it
          consists of <span className="font-serif italic font-semibold">E / (hν)</span> independent
          energy quanta of magnitude <span className="font-serif italic font-semibold">hν</span>.
        </p>
        <div className="pt-2">
          <a
            href="/papers/light-quanta#s5"
            className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
          >
            Read the original German source text and translation for §5 &rarr;
          </a>
        </div>
      </section>
    </main>
  );
}
