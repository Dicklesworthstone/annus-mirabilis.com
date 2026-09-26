/**
 * EVERY FORMULA THE DISCOVER PAGES DRAW, AS DATA (dispatch 276). A quantity gets a colour in its
 * paper's palette only when one of that paper's views names it (scripts/build-equations.ts,
 * inlineOwn), and a formula written in a page's JSX is out of the build's reach. So the pages draw
 * their formulas from here, and the build reads the same list through discoverInlineViews().
 *
 * - PAGE_FORMULAS: the formulas the journeys and the light quanta investigation write in their
 *   own markup, each with its step's scope;
 * - the relativity investigation's cards and the mass-energy investigation's steps already live in
 *   data modules, and their scopes are given here by relativityCardScope and massEnergyStepScope.
 * src/app/discover/formulaCensus.test.tsx holds the list and the rendered pages to each other, both
 * ways, so a formula added to a page and not here fails, and so does an entry no page draws.
 *
 * Pure: no component, no stylesheet, so a build script can import it.
 */
import { type JourneyScope, journeyScope, resolveJourneyFormula } from "./journeyFormulas.ts";
import { ARGUMENT_STEPS } from "./massEnergyArgument.ts";
import { RELATIVITY_CARDS } from "./specialRelativityInvestigation.ts";

export type DiscoverFormula = Readonly<{ latex: string; scope: JourneyScope }>;

const formula = (latex: string, scope: JourneyScope): DiscoverFormula => ({ latex, scope });

export const PAGE_FORMULAS = {
  /** /discover/light-quanta/ step 06: the size of each energy quantum. */
  lqQuantumSize: formula(
    String.raw`\frac{R\,\beta\,\nu}{N}`,
    journeyScope("light-quanta", "s6", "step-06"),
  ),
  /** /discover/brownian-motion/ step 02: § 2's osmotic pressure, as s2-p7 prints it. */
  bmOsmoticPressure: formula(
    String.raw`p=\frac{RT}{N}\,\nu`,
    journeyScope("brownian-motion", "s2", "step-02", "journey", "s2-p7"),
  ),
  /** /discover/brownian-motion/ step 03: § 3's diffusion coefficient, in the paper's letters. */
  bmDiffusionPrinted: formula(
    String.raw`D=\frac{RT}{N}\,\frac{1}{6\pi kP}`,
    journeyScope("brownian-motion", "s3", "step-03"),
  ),
  /** /discover/brownian-motion/ step 03: the same, in today's letters. */
  bmDiffusionModern: formula(
    String.raw`D=\frac{k_BT}{6\pi\eta a}`,
    journeyScope("brownian-motion", "s3", "step-03"),
  ),
  /** /discover/brownian-motion/ step 04: § 4's mean square displacement. */
  bmMeanSquare: formula(
    String.raw`\langle x^2\rangle=2Dt \qquad \lambda_x=\sqrt{2Dt}`,
    journeyScope("brownian-motion", "s4", "step-04"),
  ),
  /** /discover/mass-energy/ step 05: the paper's last display, in its own letters. */
  meKineticDrop: formula(
    String.raw`K_0 - K_1 = \frac{L}{V^2}\,\frac{v^2}{2}`,
    journeyScope("mass-energy", "s0", "step-05"),
  ),
  /** /discover/light-quanta/investigate/: § 4's entropy of low-density radiation. */
  lqiEntropy: formula(
    String.raw`S-S_0=\frac{E}{\beta\nu}\ln\frac{V}{V_0}`,
    journeyScope("light-quanta", "s4", "entropy", "investigate"),
  ),
  /** /discover/light-quanta/investigate/: § 5's counting, independent and locked. */
  lqiCounting: formula(
    String.raw`W_{\mathrm{independent}}=f^n,\quad W_{\mathrm{locked}}=f,\quad f=\frac{V}{V_0}`,
    journeyScope("light-quanta", "s5", "counting", "investigate"),
  ),
  /** /discover/light-quanta/investigate/: § 6's match of the two. */
  lqiMatch: formula(
    String.raw`\begin{gathered}\frac{E}{\beta\nu}=n_{\mathrm{eff}}\frac{R}{N},\\ n_{\mathrm{eff}}=\frac{NE}{R\beta\nu},\qquad \epsilon=\frac{R\beta\nu}{N}\end{gathered}`,
    journeyScope("light-quanta", "s6", "match", "investigate"),
  ),
  /** /discover/light-quanta/investigate/: § 8's emission of electrons. */
  lqiEmission: formula(
    String.raw`\begin{gathered}K_{\max}=\frac{R\beta\nu}{N}-P,\\ \Pi=\frac{K_{\max}}{e}\quad(K_{\max}\geq 0)\end{gathered}`,
    journeyScope("light-quanta", "s8", "emission", "investigate"),
  ),
  /** /discover/special-relativity/investigate/: the Galilean map, beside the ansatz. */
  sriGalilean: formula(
    String.raw`\begin{gathered}x'=x-vt,\quad t'=t;\\ x=\pm ct\ \Longrightarrow\ x'=(\pm c-v)t'\end{gathered}`,
    journeyScope("special-relativity", "s3", "galilean-map", "investigate"),
  ),
} as const satisfies Readonly<Record<string, DiscoverFormula>>;

/** A relativity investigation card's scope: clock synchronization is § 1's, the rest § 3's. */
export function relativityCardScope(cardId: string): JourneyScope {
  return journeyScope(
    "special-relativity",
    cardId === "clocks" ? "s1" : "s3",
    cardId,
    "investigate",
  );
}

/** A mass-energy investigation step's scope: the paper has no sections. */
export function massEnergyStepScope(stepId: string): JourneyScope {
  return journeyScope("mass-energy", "s0", stepId, "investigate");
}

/** Every formula the Discover pages draw. */
export const DISCOVER_FORMULAS: readonly DiscoverFormula[] = [
  ...Object.values(PAGE_FORMULAS),
  ...RELATIVITY_CARDS.map((card) => formula(card.formula, relativityCardScope(card.id))),
  ...ARGUMENT_STEPS.map((step) => formula(step.latex, massEnergyStepScope(step.id))),
];

/**
 * Each Discover formula's quantities, by paper, for the build's palette (inlineOwn in
 * scripts/build-equations.ts). A formula that does not resolve is not listed here; the page that
 * draws it stops the build, naming it.
 */
export function discoverInlineViews(): readonly Readonly<{
  paper: string;
  /** Each bound atom: its quantity, and its glyph as printed, which the palette's legend draws. */
  terms: readonly Readonly<{ quantityId: string; glyph: string }>[];
}>[] {
  return DISCOVER_FORMULAS.flatMap(({ latex, scope }) => {
    const resolved = resolveJourneyFormula(latex, scope);
    return resolved.problems.length > 0
      ? []
      : [
          {
            paper: scope.paper,
            terms: resolved.terms.map((t) => ({ quantityId: t.quantityId, glyph: t.glyph })),
          },
        ];
  });
}
