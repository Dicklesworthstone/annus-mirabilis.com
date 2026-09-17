import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkVoice } from "../src/content/checks/voice/index.ts";
import { parseContentYaml } from "../src/content/compiler/loaders.ts";
import {
  evaluatorSources,
  hashKernelSource,
  hashModuleClosure,
} from "../src/content/kernel/sourceDigest.ts";
import { encodeResult } from "../src/experiments/results/codec.ts";
import {
  CASE_DISCLAIMER,
  CASE_IDS,
  parseCountermodelCase,
} from "../src/reasoning/countermodel/caseSchema.ts";
import { evaluateCountermodelCase } from "../src/reasoning/countermodel/cellEvaluator.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENTRIES = ["src/reasoning/countermodel/session.ts", "scripts/generate-countermodels.mjs"];
const CODE_FILES = [
  "src/physics/reference/countermodels.ts",
  "src/reasoning/countermodel/cellEvaluator.ts",
];
/** The cases, model sources and generated numbers are separate, reproducible identities. */
export async function generateCountermodels(
  root = ROOT,
  profile = process.env.AM_RELEASE_PROFILE ?? "scaffold",
  outputDirectory = resolve(root, "src/generated"),
) {
  if (!["scaffold", "preview", "launch"].includes(profile))
    throw new TypeError("Unknown countermodel publication profile.");
  const sourceDigest = hashModuleClosure(root, ENTRIES);
  const sourceFiles = evaluatorSources(root, ENTRIES).map(([path, text]) => ({
    path,
    hash: hashKernelSource(text),
  }));
  const sourceCode = await Promise.all(
    CODE_FILES.map(async (path) => {
      const text = await readFile(resolve(root, path), "utf8");
      return { path, text, hash: hashKernelSource(text) };
    }),
  );
  const directory = resolve(root, "content/reasoning/countermodel");
  const actual = (await readdir(directory)).filter((name) => /\.ya?ml$/u.test(name)).sort();
  const expected = CASE_IDS.map((id) => `${id}.yaml`).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error("Additional countermodel cases need an explicit expansion decision.");
  const cases = [];
  for (const id of CASE_IDS) {
    const text = await readFile(resolve(directory, `${id}.yaml`), "utf8");
    const spec = parseCountermodelCase(parseContentYaml(text));
    if (spec.id !== id) throw new Error("The case file and its content id differ.");
    const copy = [
      CASE_DISCLAIMER,
      spec.title,
      spec.question,
      spec.scope,
      ...spec.candidates.flatMap((candidate) => [candidate.label, candidate.circumstances]),
      ...spec.tests.flatMap((test) => [test.label, test.explanation, test.tolerance.reason]),
    ];
    for (const value of copy)
      if (
        checkVoice(value, { context: "countermodel-cell" }).some(
          (finding) => finding.severity === "error",
        )
      )
        throw new Error(`Countermodel copy did not pass the shared voice rules: ${id}.`);
    const results = evaluateCountermodelCase(spec, spec.defaultBeta).outputs.map(encodeResult);
    if (profile === "scaffold")
      cases.push({
        case: spec,
        sourceDigest,
        caseRevision: createHash("sha256").update(text).digest("hex"),
        results,
      });
  }
  // Draft scientific prose is not silently promoted by successful numerical validation.
  const output = { schemaVersion: 1, profile, sourceDigest, sourceFiles, sourceCode, cases };
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(resolve(outputDirectory, "countermodels.json"), `${JSON.stringify(output)}\n`);
  return output;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = await generateCountermodels();
  console.log(
    JSON.stringify({
      event: "countermodels-generated",
      profile: output.profile,
      cases: output.cases.length,
      sourceDigest: output.sourceDigest,
    }),
  );
}
