import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { compileReadingContent } from "../src/content/compiler/compile.ts";
import { compileEquation } from "../src/equations/render.ts";
import { loadReadingFiles } from "./build-content.ts";

const result = compileReadingContent(await loadReadingFiles());
if (!result.ok) throw new Error("Invalid reading content; equations were not generated.");
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
  "src/experiments/bm01/definition.ts",
  "src/experiments/me02/definition.ts",
  "src/equations/navigation.ts",
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
// Each route receives only its paper's payload. Extending admission must not
// quietly attach every mass-energy equation to the Brownian reader/laboratory.
for (const [paper, file] of [
  ["brownian-motion", "brownian-equations"],
  ["mass-energy", "mass-energy-equations"],
] as const) {
  await writeFile(
    `src/generated/${file}.json`,
    `${JSON.stringify({ schemaVersion: 1, rendererDigest,
      equations: equations.filter(equation => equation.paper === paper) }, null, 2)}\n`,
  );
}
console.log(
  JSON.stringify({ event: "equations-compiled", count: equations.length, rendererDigest }),
);
