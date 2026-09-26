import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { renderToString } from "katex";
import { loadFirstUseTargets, resolveFirstUse } from "../src/app/notation/firstUseTargets.ts";
import { compileReadingContent } from "../src/content/compiler/compile.ts";
import { loadConcordanceForPaper } from "../src/content/notation/loader.ts";
import { getQuantity } from "../src/content/quantities/registry.ts";
import { citedLessonTitles } from "../src/equations/citedLessonTitles.ts";
import { buildMassEnergyElimination } from "../src/equations/derivations/massEnergyElimination.ts";
import { buildMassEnergyLowSpeed } from "../src/equations/derivations/massEnergyLowSpeed.ts";
import { renderLowSpeedProof } from "../src/equations/derivations/renderLowSpeed.ts";
import { notationNoteTarget } from "../src/equations/notationNoteTarget.ts";
import { explanationFormulas } from "../src/equations/printed/explanationFormulas.ts";
import { labFormulaSites } from "../src/equations/printed/labFormulaSites.ts";
import { labInlineViews } from "../src/equations/printed/labInlines.ts";
import { assertPublishable, printedDisplays } from "../src/equations/printed/paperDisplays.ts";
import {
  assertInlinesPublishable,
  checkPaperInlines,
  ENFORCED_INLINE_PAPERS,
  inlineQuantityFacts,
} from "../src/equations/printed/paperInlines.ts";
import {
  assignQuantityColoursPreferring,
  QUANTITY_PALETTE,
} from "../src/equations/quantityColours.ts";
import { compileEquation, compileEquationWithNotation } from "../src/equations/render.ts";
import { COLOURED_EXPLANATION_PAPERS } from "../src/reader/explanationInlines.ts";
import { NOTATION_TOGGLE_PAPERS } from "../src/reader/navigation/state.ts";
import { paperSourceFaces } from "../src/reader/paperSourceFaces.ts";
import { partLabel } from "../src/reader/unexplainedParts.ts";
import { loadReadingFiles } from "./build-content.ts";

const result = compileReadingContent(await loadReadingFiles());
if (!result.ok) throw new Error("Invalid reading content; equations were not generated.");
const massEnergyPaper = result.papers.find((p) => p.paper.id === "mass-energy");
if (!massEnergyPaper) throw new Error("Missing mass-energy paper for the checked derivation.");
const elimination = buildMassEnergyElimination(massEnergyPaper.equations);
for (const step of elimination.steps) {
  if (!result.foundations.some((f) => f.id === step.foundation))
    throw new Error(`Missing derivation foundation ${step.foundation}.`);
}
const lowSpeed = buildMassEnergyLowSpeed(massEnergyPaper.equations);
// The papers whose explanation faces carry the notation toggle (am-read-perspective-toggle-abd):
// each of their records is drawn a second time in Einstein's letters, read from the paper's
// concordance for the section its argument sits in.
// Where a formula that keeps today's letters sends the reader for Einstein's, by the face
// chooser's own rule: the German face only when it renders text (notationNoteTarget.ts).
const sourceFacesOf = new Map(
  await Promise.all(
    result.papers
      .filter((p) => NOTATION_TOGGLE_PAPERS.includes(p.paper.id))
      .map(async (p) => [p.paper.id, await paperSourceFaces(p.paper.id)] as const),
  ),
);
// The foundation lessons' records compile beside the papers', under their own "paper".
const equations = [
  ...result.papers.flatMap((p) => {
    if (!NOTATION_TOGGLE_PAPERS.includes(p.paper.id)) return p.equations.map(compileEquation);
    const { entries } = loadConcordanceForPaper(p.paper.id);
    const sectionOf = new Map(p.arguments.map((a) => [a.id, a.section]));
    const sources = sourceFacesOf.get(p.paper.id);
    const pdf = `papers/pdfs/${p.paper.citation}.pdf`;
    const pdfHref = existsSync(`public/${pdf}`) ? `/${pdf}` : null;
    // A record with no section is matched to no entry, so it keeps today's letters and says so.
    return p.equations.map((e) => {
      const section = (e.argument ? sectionOf.get(e.argument) : undefined) ?? "";
      return compileEquationWithNotation(e, {
        entries,
        section,
        seeAt: notationNoteTarget({
          paperId: p.paper.id,
          germanAvailable: sources?.availability.german === "available",
          germanFragment: sources?.sectionFragment(section) ?? "",
          pdfHref,
          // The notes on one page link to different sections, so each link names its section.
          part: section ? partLabel(section) : undefined,
        }),
      });
    });
  }),
  ...result.foundationEquations.map(compileEquation),
];
// PRINTED DISPLAYS IN COLOUR (dispatch 224): Einstein's own formulas on the reading faces, with
// the bindings content/display-terms/<paper>.yaml gives their glyphs. Any problem stops the build by
// name, as a bad equation record does.
// Where no model record is linked, the inspector falls back to the registry and the concordance
// (dispatch 250); a concordance first use links to the page that carries it, as /notation/ does.
const firstUseTargets = await loadFirstUseTargets();
const printed = await printedDisplays(
  process.cwd(),
  result.papers.map((p) => p.paper.id),
  equations,
  { firstUse: (paper, anchor) => resolveFirstUse(paper, anchor, firstUseTargets) },
);
assertPublishable(printed);
// INLINE FORMULAS IN COLOUR (dispatch 272): every formula set in a sentence, each glyph bound by
// the notation concordance of its scope (inlineTerms.ts, paperInlines.ts). A refusal in an enforced
// paper stops the build by name; in any other paper the formula stays plain and the refusals are
// named here, never passed over in silence.
const inlinePapers = await Promise.all(
  result.papers.map((p) => checkPaperInlines(process.cwd(), p.paper.id)),
);
// An explanation page's inline formulas (dispatch 273), for each paper whose explanations are drawn
// in colour (src/reader/explanationInlines.ts). Computed here as the page computes them, so their
// quantities get colour slots with the faces' inline formulas and the inspector has their facts.
const explanationPapers = COLOURED_EXPLANATION_PAPERS.map((paper) =>
  explanationFormulas(process.cwd(), paper),
);
for (const e of explanationPapers)
  console.log(
    JSON.stringify({
      event: "explanation-formulas",
      paper: e.paper,
      formulas: e.formulas.length,
      quantities: Object.keys(e.quantities).length,
    }),
  );
// A laboratory's formulas (dispatch 274), read from the lab pages' JSX (labFormulaSites.ts) and
// resolved as the pages resolve them (labInlines.ts), so their quantities get colour slots with the
// faces' inline formulas, two quantities of one lab formula differ, and each lab's island has its
// quantities' facts.
const labViews = labInlineViews(labFormulaSites(process.cwd()));
for (const l of Object.values(labViews.papers))
  console.log(
    JSON.stringify({
      event: "lab-formulas",
      paper: l.paper,
      formulas: l.formulas.length,
      quantities: Object.keys(l.quantities).length,
    }),
  );
for (const p of inlinePapers) {
  console.log(JSON.stringify({ event: "inline-formulas", paper: p.paper, ...p.census }));
  if (p.problems.length > 0 && !ENFORCED_INLINE_PAPERS.includes(p.paper))
    console.log(
      JSON.stringify({
        event: "inline-formulas-left-plain",
        paper: p.paper,
        refusals: p.problems.length,
        glyphs: [...new Set(p.problems.map((problem) => `${problem.glyph} (${problem.where})`))],
      }),
    );
}
assertInlinesPublishable(inlinePapers);
const sourcePaths = [
  "src/equations/printed/inlineTerms.ts",
  "src/equations/printed/paperInlines.ts",
  ...(existsSync("content/inline-terms/exceptions.yaml")
    ? ["content/inline-terms/exceptions.yaml"]
    : []),
  "src/equations/render.ts",
  "src/equations/latex/printedAtoms.ts",
  "src/equations/printed/displayTerms.ts",
  "src/equations/printed/paperDisplays.ts",
  "src/equations/printed/fallbackFacts.ts",
  "src/equations/termFacts.ts",
  "src/content/quantities/readerDescriptions.ts",
  "content/reader-descriptions/quantities.yaml",
  ...result.papers.map((p) => `content/display-terms/${p.paper.id}.yaml`).filter(existsSync),
  "src/equations/latex.ts",
  "src/equations/latex/render.ts",
  "src/equations/notationForms.ts",
  "src/equations/notationNoteTarget.ts",
  // Every paper whose records are drawn in Einstein's letters reads its concordance.
  ...NOTATION_TOGGLE_PAPERS.map((paper) => `content/notation/${paper}.yaml`),
  "src/equations/record.ts",
  "src/equations/ast.ts",
  "src/equations/dimensions.ts",
  "src/equations/quantities.ts",
  "src/equations/massEnergyQuantities.ts",
  "src/equations/teachingProfiles.ts",
  "src/equations/quantityColours.ts",
  "src/experiments/bm01/definition.ts",
  "src/experiments/me02/definition.ts",
  "src/equations/navigation.ts",
  "src/equations/derivations/exactPolynomial.ts",
  "src/equations/derivations/exactSeries.ts",
  "src/equations/derivations/massEnergyLowSpeed.ts",
  "src/equations/derivations/renderLowSpeed.ts",
  "src/equations/derivations/linearCertificate.ts",
  "src/equations/derivations/massEnergyElimination.ts",
  "src/content/dimensions/rational.ts",
  "scripts/build-equations.ts",
  "package.json",
];
const rendererDigest = createHash("sha256")
  .update(
    (await Promise.all(sourcePaths.map(async (p) => `${p}\0${await readFile(p, "utf8")}`))).join(
      "\0",
    ),
  )
  .digest("hex");
await mkdir("src/generated", { recursive: true });
// The title of every lesson a payload's notes cite, beside the equations rather than in them, so
// each compiled equation stays exactly what compileEquation(record) returns. A prerequisite link
// names its lesson with it: note titles repeat ("What it asserts" is on nine Brownian relations),
// and a link named by the note alone reached five different lessons under one name.
const lessonTitles = (own: readonly (typeof equations)[number][]) =>
  citedLessonTitles(own, result.foundations);
// Each route receives only its paper's payload. Extending admission must not
// quietly attach every mass-energy equation to the Brownian reader/laboratory.
for (const [paper, file] of [
  ["brownian-motion", "brownian-equations"],
  ["mass-energy", "mass-energy-equations"],
  ["light-quanta", "light-quanta-equations"],
  ["special-relativity", "special-relativity-equations"],
] as const) {
  await writeFile(
    `src/generated/${file}.json`,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        rendererDigest,
        equations: equations.filter((equation) => equation.paper === paper),
        foundationTitles: lessonTitles(equations.filter((equation) => equation.paper === paper)),
      },
      null,
      2,
    )}\n`,
  );
}
// One payload per argument, for the reading page's "Explore the equations in this step"
// (LazyArgumentEquations). Opening it loaded the paper's whole payload to show that one step's
// cards: measured on live, 52 KB compressed for two cards on special-relativity, whose payload
// is 710 KB of JSON a phone then parses. The paper payloads above stay as they are, for the
// section pages and laboratories that render every equation. Files are written, never removed:
// one left behind by a renamed argument is loaded by no page.
await mkdir("src/generated/argument-equations", { recursive: true });
const equationsByArgument = new Map<string, (typeof equations)[number][]>();
for (const equation of equations) {
  if (equation.paper === "foundations" || !equation.argument) continue;
  equationsByArgument.set(equation.argument, [
    ...(equationsByArgument.get(equation.argument) ?? []),
    equation,
  ]);
}
for (const [argument, own] of equationsByArgument) {
  await writeFile(
    `src/generated/argument-equations/${argument}.json`,
    `${JSON.stringify(
      { schemaVersion: 1, rendererDigest, equations: own, foundationTitles: lessonTitles(own) },
      null,
      2,
    )}\n`,
  );
}
// The tracer laboratory's own payload: only the equations bound to a bm-01 output. It is a client
// component, so whatever it imports ships as first-route JavaScript on /papers/brownian-motion/.
// Importing the whole Brownian payload put nine derivation-only records (the (A+B)^2 identity,
// the Avogadro inference) into that bundle and into "Equations for this accepted trial".
// The foundation lessons' payload: read by FoundationBody on /foundations/ and wherever a paper shows
// a lesson in place, so a lesson's formula is coloured the same everywhere it appears.
const foundationEquations = equations.filter((equation) => equation.paper === "foundations");
await writeFile(
  "src/generated/foundation-equations.json",
  `${JSON.stringify(
    {
      schemaVersion: 1,
      rendererDigest,
      equations: foundationEquations,
      foundationTitles: lessonTitles(foundationEquations),
    },
    null,
    2,
  )}\n`,
);
const bm01Equations = equations.filter(
  (equation) =>
    equation.paper === "brownian-motion" &&
    equation.bindings.some((binding) => binding.experimentId === "bm-01"),
);
await writeFile(
  "src/generated/bm01-equations.json",
  `${JSON.stringify(
    {
      schemaVersion: 1,
      rendererDigest,
      equations: bm01Equations,
      foundationTitles: lessonTitles(bm01Equations),
    },
    null,
    2,
  )}\n`,
);
/*
  ONE COLOUR PER QUANTITY, PER PAPER (owner's ruling, 2026-09-22). The map is computed from the
  paper's records together, because a colour is only unique relative to the other quantities in
  view, and it is written beside the payloads rather than into them, so each compiled equation
  stays exactly what compileEquation(record) returns. The glyph is rendered here, at build time,
  so the legend can show it without shipping KaTeX to the reader.
*/
const quantityColours: Record<
  string,
  Record<string, { slot: number; name: string; glyphHtml: string }>
> = {};
const sharedPrintedViews: Record<string, readonly string[]> = {};
for (const paper of [...new Set(equations.map((e) => e.paper))].sort()) {
  const own = equations.filter((e) => e.paper === paper);
  // A reading formula that names several records shows them side by side: one view, one palette.
  const togetherIn = (blocks: readonly (typeof result.foundations)[number]["example"][number][]) =>
    blocks.flatMap((b) =>
      b.kind === "formula" && (b.equations?.length ?? 0) > 1 ? [b.equations ?? []] : [],
    );
  const shownTogether =
    paper === "foundations"
      ? result.foundations.flatMap((f) => togetherIn([...f.explanation, ...f.example]))
      : (result.papers.find((p) => p.paper.id === paper)?.arguments ?? []).flatMap((a) =>
          Object.values(a.readings).flatMap(togetherIn),
        );
  // Each printed display is a view of its own (dispatch 224): its quantities differ from one
  // another as an equation's do, and share the map, so a quantity is one colour on every face.
  const printedOwn = [
    ...new Map(
      printed.displays.filter((d) => d.paper === paper).map((d) => [d.display, d]),
    ).values(),
  ];
  // Each inline formula is a view as a display is: its quantities differ from one another. Views
  // with the same quantities are one view, and a quantity only an inline formula names still gets
  // its colour (dispatch 272).
  const inlineOwn = [
    ...Object.values(inlinePapers.find((p) => p.paper === paper)?.formulas ?? {}),
    ...(explanationPapers.find((e) => e.paper === paper)?.formulas ?? []),
    ...(labViews.papers[paper]?.formulas ?? []),
  ].filter((f) => f.terms.length > 0);
  const inlineViews = [
    ...new Map(
      inlineOwn.map((f) => {
        const ids = [...new Set(f.terms.map((t) => t.quantityId))].sort();
        return [ids.join(" "), ids] as const;
      }),
    ),
  ].map(([key, quantityIds]) => ({ id: `inline:${key}`, argument: `inline:${key}`, quantityIds }));
  const ownViews = own.map((e) => ({
    id: e.id,
    argument: e.argument,
    quantityIds: e.terms.map((t) => t.quantityId),
  }));
  const displayViews = printedOwn.map((d) => ({
    id: `printed:${d.display}`,
    argument: `printed:${d.display}`,
    quantityIds: d.terms.map((t) => t.quantityId),
  }));
  // The displays are coloured first, exactly as before inline formulas were: a small inline view
  // admitted ahead of a display could otherwise take the colour that kept the display distinct.
  // The inline views are then admitted around the displays that were.
  const first = assignQuantityColoursPreferring(ownViews, displayViews, shownTogether);
  // A display the first pass could not make distinct keeps its quantities coloured, each on its
  // own, as the first pass does (quantityColours.ts): loose views of one quantity.
  const looseDisplays = displayViews
    .filter((v) => first.shared.includes(v.id))
    .flatMap((v) =>
      [...new Set(v.quantityIds)].map((id) => ({
        id: `${v.id}#${id}`,
        argument: v.argument,
        quantityIds: [id],
      })),
    );
  const second = assignQuantityColoursPreferring(
    [...ownViews, ...displayViews.filter((v) => !first.shared.includes(v.id)), ...looseDisplays],
    inlineViews,
    shownTogether,
  );
  const { slots } = second;
  const shared = first.shared;
  const nodes = first.nodes + second.nodes;
  if (second.shared.length > 0)
    console.log(
      JSON.stringify({
        event: "inline-formula-shares-a-colour",
        paper,
        views: second.shared.length,
      }),
    );
  // A printed display the palette cannot make distinct is said, never hidden (quantityColours.ts),
  // and so is the search's cost, bounded by a node budget per search (dispatch 230).
  if (shared.length > 0)
    console.log(
      JSON.stringify({ event: "printed-display-shares-a-colour", paper, displays: shared }),
    );
  console.log(JSON.stringify({ event: "quantity-colours-assigned", paper, searchNodes: nodes }));
  sharedPrintedViews[paper] = shared;
  // Keyed from the same terms the colouring was computed from, so every coloured id has its record.
  // A quantity only a printed display names is named from the registry and drawn in its letter.
  const quantities = new Map<string, { name: string; glyph: string }>([
    ...inlineOwn.flatMap((f) =>
      f.terms.map(
        (t) => [t.quantityId, { name: getQuantity(t.quantityId).name, glyph: t.glyph }] as const,
      ),
    ),
    ...printedOwn.flatMap((d) =>
      d.legend.map(
        (l) => [l.quantityId, { name: getQuantity(l.quantityId).name, glyph: l.glyph }] as const,
      ),
    ),
    ...own.flatMap((e) => e.terms.map((t) => [t.quantityId, t.quantity] as const)),
  ]);
  quantityColours[paper] = Object.fromEntries(
    Object.entries(slots)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .flatMap(([quantityId, slot]) => {
        const quantity = quantities.get(quantityId);
        return quantity
          ? [
              [
                quantityId,
                {
                  slot,
                  name: quantity.name,
                  glyphHtml: renderToString(quantity.glyph, {
                    output: "html",
                    throwOnError: true,
                    strict: "error",
                    trust: false,
                    maxExpand: 100,
                    maxSize: 10,
                  }),
                },
              ] as const,
            ]
          : [];
      }),
  );
}
/*
  One rule per term id, for every paper, as a stylesheet. Every view that shows a compiled
  equation's HTML (the explorer, the reading's formulas, the mass-energy derivations) then colours
  its terms by quantity without writing rules of its own; term ids are globally unique.
*/
const termRules = equations
  .flatMap((e) =>
    e.terms.flatMap((t) => {
      const colour = quantityColours[e.paper]?.[t.quantityId];
      const pattern = colour ? QUANTITY_PALETTE[colour.slot]?.pattern : undefined;
      return colour && pattern
        ? [`[data-term="${t.termId}"] { --qc: var(--q-${colour.slot}); --qd: ${pattern}; }`]
        : [];
    }),
  )
  .sort();
/*
  One rule per quantity per paper, for the client components (the explorer, show-the-code, the
  tracer lab): they mark their root with data-paper and each coloured element with its quantity
  id, and take the colour from here, so none of them ships the colour map in its JavaScript.
  These rules are their own sheet, which those components import themselves (am-ywtb): inside
  quantity-colours.css they reached only pages that also had a reading formula, and a lab's
  explorer showed blank dots. Since every KaTeX term span carries its quantity id, these rules
  alone colour an explorer completely; the per-term rules colour the reading's formulas.
*/
const paperRules: string[] = [];
for (const [paper, quantities] of Object.entries(quantityColours).sort(([a], [b]) =>
  a < b ? -1 : 1,
))
  for (const [quantityId, { slot }] of Object.entries(quantities)) {
    const pattern = QUANTITY_PALETTE[slot]?.pattern;
    if (pattern)
      paperRules.push(
        `[data-paper="${paper}"] [data-quantity-id="${quantityId}"] { --qc: var(--q-${slot}); --qd: ${pattern}; }`,
      );
  }
await writeFile(
  "src/generated/quantity-colours.css",
  `/* Generated by scripts/build-equations.ts. One colour per quantity, per term id. */\n${termRules.join("\n")}\n`,
);
/*
  The sheet carries the palette too: a laboratory whose only coloured view is show-the-code (bm-05,
  bm-06) imports no equations.css, and there var(--q-N) resolved to nothing. The values come from
  QUANTITY_PALETTE, the source quantityColours.test.ts holds equations.css to, under the same three
  theme selectors, so the two declarations of a slot cannot differ.
*/
const palette = (key: "light" | "dark") =>
  QUANTITY_PALETTE.map((slot, i) => `--q-${i}: ${slot[key]};`).join(" ");
const paletteRules = [
  `:root { ${palette("light")} }`,
  `:root[data-theme="kramgasse-night"] { ${palette("dark")} }`,
  `@media (prefers-color-scheme: dark) { :root:not([data-theme]) { ${palette("dark")} } }`,
];
await writeFile(
  "src/generated/quantity-colours-by-paper.css",
  `/* Generated by scripts/build-equations.ts. One colour per quantity, per paper. */\n${[...paletteRules, ...paperRules].join("\n")}\n`,
);
await writeFile(
  "src/generated/printed-displays.json",
  `${JSON.stringify(
    { schemaVersion: 1, rendererDigest, displays: printed.displays, sharedPrintedViews },
    null,
    2,
  )}\n`,
);
await writeFile(
  "src/generated/printed-inlines.json",
  `${JSON.stringify({
    schemaVersion: 1,
    rendererDigest,
    // Only a paper whose every inline formula resolves is drawn in colour: one half-coloured would
    // read as though its plain formulas meant something different. The census covers all four.
    papers: Object.fromEntries(
      inlinePapers
        .filter((p) => ENFORCED_INLINE_PAPERS.includes(p.paper))
        .map((p) => [
          p.paper,
          {
            holders: p.holders,
            formulas: p.formulas,
            quantities: inlineQuantityFacts(process.cwd(), p, {
              firstUse: (paper, anchor) => resolveFirstUse(paper, anchor, firstUseTargets),
            }),
          },
        ]),
    ),
  })}\n`,
);
await writeFile(
  "src/generated/explanation-inlines.json",
  `${JSON.stringify({
    schemaVersion: 1,
    rendererDigest,
    // The inspector's facts for each quantity an explanation formula binds (ExplanationInlineTerms).
    papers: Object.fromEntries(
      explanationPapers.map((e) => [
        e.paper,
        {
          quantities: inlineQuantityFacts(process.cwd(), e, {
            firstUse: (paper, anchor) => resolveFirstUse(paper, anchor, firstUseTargets),
          }),
        },
      ]),
    ),
  })}\n`,
);
// The inspector's facts for each quantity a lab's formulas bind, lab by lab (LabInlineTerms).
const labFacts = Object.fromEntries(
  Object.values(labViews.papers).map((l) => [
    l.paper,
    inlineQuantityFacts(process.cwd(), l, {
      firstUse: (paper, anchor) => resolveFirstUse(paper, anchor, firstUseTargets),
    }),
  ]),
);
await writeFile(
  "src/generated/lab-inlines.json",
  `${JSON.stringify({
    schemaVersion: 1,
    rendererDigest,
    labs: Object.fromEntries(
      Object.entries(labViews.labs).map(([lab, l]) => [
        lab,
        {
          paper: l.paper,
          quantities: Object.fromEntries(
            l.quantityIds.flatMap((id) => {
              const facts = labFacts[l.paper]?.[id];
              return facts ? [[id, facts]] : [];
            }),
          ),
        },
      ]),
    ),
  })}\n`,
);
await writeFile(
  "src/generated/quantity-colours.json",
  `${JSON.stringify({ schemaVersion: 1, rendererDigest, papers: quantityColours }, null, 2)}\n`,
);
const usedIds = new Set([
  ...elimination.certificate.premises.flatMap((p) => p.equations),
  ...elimination.certificate.steps.map((step) => step.equation),
]);
const proofEquations = equations
  .filter((e) => usedIds.has(e.id))
  .map(({ id, argument, title, spoken, html, mathml, plainLatex, treeDigest }) => ({
    id,
    argument,
    title,
    spoken,
    html,
    mathml,
    plainLatex,
    treeDigest,
  }));
if (proofEquations.length !== usedIds.size)
  throw new Error("A checked proof equation was not rendered.");
const sourceDigest = `sha256:${createHash("sha256")
  .update(JSON.stringify({ rendererDigest, elimination, proofEquations }))
  .digest("hex")}`;
await writeFile(
  "src/generated/mass-energy-elimination.json",
  `${JSON.stringify({ ...elimination, equations: proofEquations, sourceDigest }, null, 2)}\n`,
);
const lowSpeedView = renderLowSpeedProof(lowSpeed, equations);
const lowSpeedDigest = `sha256:${createHash("sha256").update(JSON.stringify({ rendererDigest, lowSpeedView })).digest("hex")}`;
await writeFile(
  "src/generated/mass-energy-low-speed.json",
  `${JSON.stringify({ ...lowSpeedView, sourceDigest: lowSpeedDigest }, null, 2)}\n`,
);
console.log(
  JSON.stringify({ event: "equations-compiled", count: equations.length, rendererDigest }),
);
