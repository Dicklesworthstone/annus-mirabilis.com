import type { Metadata } from "next";
import { FluorescenceLab } from "../../../components/lab/lq07/FluorescenceLab.tsx";
import { LQ07_DEFAULTS } from "../../../experiments/lq07/definition.ts";
import { evaluateLq07, type PreparedLq07Example } from "../../../experiments/lq07/session.ts";

export const metadata: Metadata = {
  title: "LQ-07: Fluorescence Energy Budget & Stokes's Rule",
  description:
    "Explore how single-quantum energy conservation hν₁ = hν₂ + E_other explains Stokes's rule and predicts multi-quantum and thermal deviation conditions in Einstein's 1905 paper.",
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
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      <header className="page-intro mb-6 text-center">
        <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">
          Light Quanta · Paper 1, §7 Energy Conservation
        </p>
        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-foreground">
          Stokes's Rule and the Single-Quantum Energy Budget
        </h1>
        <p className="text-base text-muted-foreground mt-2 max-w-2xl mx-auto font-serif">
          Why the frequency of emitted fluorescent light cannot exceed that of the exciting light
          under elementary quantum transformation, and how Einstein deduced the exact conditions for
          exceptions.
        </p>
      </header>

      <FluorescenceLab example={example} />

      <section
        id="fluorescence-argument"
        className="mt-12 border-t border-border/80 pt-8 max-w-3xl mx-auto space-y-4"
      >
        <h2 className="text-xl font-serif font-bold text-foreground">
          The Single-Quantum Energy Budget in Einstein 1905 §7
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          In 1852, George Gabriel Stokes formulated the empirical rule that fluorescent light always
          has a lower frequency (longer wavelength) than the light that excited it. In §7 of his
          1905 paper, Einstein showed that this rule is an immediate consequence of the
          light-quantum hypothesis:
        </p>
        <blockquote className="border-l-2 border-primary/60 pl-4 my-3 text-xs italic text-muted-foreground">
          &ldquo;If monochromatic light of frequency ν₁ is transformed into light of frequency ν₂ by
          photoluminescence, and if the process occurs such that one absorbed quantum is converted
          into one emitted quantum plus non-optical energy... then the energy of the emitted quantum
          cannot be greater than that of the exciting one.&rdquo;
        </blockquote>
        <div className="p-4 bg-muted/30 border border-border rounded-lg text-center font-mono text-sm font-bold my-4">
          hν₁ = hν₂ + E_other &emsp;(E_other ≥ 0) &emsp;&Longrightarrow;&emsp; ν₂ ≤ ν₁
        </div>

        <h3 className="text-base font-serif font-bold text-foreground pt-2">
          The Two Historical Deviation Cases
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Rather than stating Stokes's rule as an unbreakable law, Einstein explicitly deduced the
          physical conditions under which anti-Stokes emission (ν₂ &gt; ν₁) can occur:
        </p>
        <ul className="text-xs text-muted-foreground space-y-2 list-disc list-inside">
          <li>
            <strong>Deviation Case 1 (Multi-quantum absorption):</strong> If the elementary process
            involves the simultaneous absorption of{" "}
            <span className="font-serif italic font-semibold">k</span> light quanta, the available
            energy is <code className="font-mono text-foreground font-semibold">k hν₁</code>,
            permitting emission up to{" "}
            <code className="font-mono text-foreground font-semibold">ν₂ ≤ k ν₁</code>.
          </li>
          <li>
            <strong>Deviation Case 2 (Non-Wien exciting radiation):</strong> If the incident light
            is not in the Wien regime (where the light-quantum volume law was derived),
            single-quantum behavior is not guaranteed.
          </li>
        </ul>

        <div className="pt-4">
          <a
            href="/papers/light-quanta#s7"
            className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
          >
            Read the original German source text and translation for §7 &rarr;
          </a>
        </div>
      </section>
    </main>
  );
}
