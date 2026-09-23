import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { renderToString } from "katex";
import { compileReadingContent } from "../src/content/compiler/compile.ts";
import { buildMassEnergyElimination } from "../src/equations/derivations/massEnergyElimination.ts";
import { buildMassEnergyLowSpeed } from "../src/equations/derivations/massEnergyLowSpeed.ts";
import { renderLowSpeedProof } from "../src/equations/derivations/renderLowSpeed.ts";
import { assignQuantityColours, QUANTITY_PALETTE } from "../src/equations/quantityColours.ts";
import { compileEquation } from "../src/equations/render.ts";
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
const equations = result.papers.flatMap((p) => p.equations.map(compileEquation));
const sourcePaths = [
  "src/equations/render.ts",
  "src/equations/latex.ts",
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
  Object.fromEntries(
    [...new Set(own.flatMap((equation) => equation.notes.map((note) => note.foundation)))]
      .sort()
      .map((id) => {
        const foundation = result.foundations.find((f) => f.id === id);
        if (!foundation) throw new Error(`Equation note cites unknown foundation ${id}.`);
        return [id, foundation.title];
      }),
  );
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
// The tracer laboratory's own payload: only the equations bound to a bm-01 output. It is a client
// component, so whatever it imports ships as first-route JavaScript on /papers/brownian-motion/.
// Importing the whole Brownian payload put nine derivation-only records (the (A+B)^2 identity,
// the Avogadro inference) into that bundle and into "Equations for this accepted trial".
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
for (const paper of [...new Set(equations.map((e) => e.paper))].sort()) {
  const own = equations.filter((e) => e.paper === paper);
  // A reading formula that names several records shows them side by side: one view, one palette.
  const shownTogether = (result.papers.find((p) => p.paper.id === paper)?.arguments ?? []).flatMap(
    (a) =>
      Object.values(a.readings).flatMap((blocks) =>
        blocks.flatMap((b) =>
          b.kind === "formula" && (b.equations?.length ?? 0) > 1 ? [b.equations ?? []] : [],
        ),
      ),
  );
  const slots = assignQuantityColours(
    own.map((e) => ({
      id: e.id,
      argument: e.argument,
      quantityIds: e.terms.map((t) => t.quantityId),
    })),
    shownTogether,
  );
  // Keyed from the same terms the colouring was computed from, so every coloured id has its record.
  const quantities = new Map(
    own.flatMap((e) => e.terms.map((t) => [t.quantityId, t.quantity] as const)),
  );
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
*/
for (const [paper, quantities] of Object.entries(quantityColours).sort(([a], [b]) =>
  a < b ? -1 : 1,
))
  for (const [quantityId, { slot }] of Object.entries(quantities)) {
    const pattern = QUANTITY_PALETTE[slot]?.pattern;
    if (pattern)
      termRules.push(
        `[data-paper="${paper}"] [data-quantity-id="${quantityId}"] { --qc: var(--q-${slot}); --qd: ${pattern}; }`,
      );
  }
await writeFile(
  "src/generated/quantity-colours.css",
  `/* Generated by scripts/build-equations.ts. One colour per quantity, per term id. */\n${termRules.join("\n")}\n`,
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
