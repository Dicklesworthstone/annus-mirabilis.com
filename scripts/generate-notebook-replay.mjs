import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateAliasRecord } from "../src/content/aliases.ts";
import { parseContentYaml } from "../src/content/compiler/loaders.ts";
import { loadPaperPayload } from "../src/content/compiler/serverLoaders.ts";
import { bm01ComparisonIdentity } from "../src/experiments/bm01/comparison.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Small public revision catalogue only. Never read localStorage, notebook files or reader words. */
export async function generateNotebookReplay(
  root = ROOT,
  outputDirectory = resolve(root, "src/generated"),
) {
  const example = JSON.parse(
    await readFile(resolve(root, "src/generated/bm01-comparison.json"), "utf8"),
  );
  const identity = bm01ComparisonIdentity(example);
  if (!/^source:sha256:[a-f0-9]{64}$/u.test(identity.sourceDigest))
    throw new Error("Generate the current comparison example first.");
  const paper = await loadPaperPayload("brownian-motion", root);
  const passages = Object.fromEntries(
    paper.arguments.map((argument) => [
      argument.id,
      {
        contentRevision: createHash("sha256").update(JSON.stringify(argument)).digest("hex"),
        translationRevision: null, // This compiled schema contains explanations, not reviewed translations.
      },
    ]),
  );
  const raw = parseContentYaml(
    await readFile(resolve(root, "content/aliases/brownian-motion.yaml"), "utf8"),
  );
  if (!raw || raw.paper !== "brownian-motion" || !Array.isArray(raw.aliases))
    throw new Error("Invalid Brownian alias collection.");
  const aliases = raw.aliases.map((value) => {
    const checked = validateAliasRecord(value);
    if (!checked.ok) throw new Error(checked.error);
    return checked.value;
  });
  const output = { identity, passages, aliases };
  if (!Object.hasOwn(passages, "arg-bm-observable"))
    throw new Error("The saved comparison passage must resolve to a compiled argument.");
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(resolve(outputDirectory, "notebook-replay.json"), `${JSON.stringify(output)}\n`);
  return output;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await generateNotebookReplay();
  console.log(
    JSON.stringify({
      event: "notebook-replay-catalogue-generated",
      passages: Object.keys(result.passages).length,
      sourceDigest: result.identity.sourceDigest,
    }),
  );
}
