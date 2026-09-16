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
await writeFile(
  "src/generated/brownian-equations.json",
  JSON.stringify({ schemaVersion: 1, rendererDigest, equations }, null, 2) + "\n",
);
console.log(
  JSON.stringify({ event: "equations-compiled", count: equations.length, rendererDigest }),
);
