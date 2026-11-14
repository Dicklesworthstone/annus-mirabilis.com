import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateAliasRecord } from "../src/content/aliases.ts";
import { parseContentYaml } from "../src/content/compiler/loaders.ts";
import { loadPaperPayload } from "../src/content/compiler/serverLoaders.ts";
import { prepareSr03Comparisons } from "../src/content/sr03Comparison.ts";
import { bm01ComparisonIdentity } from "../src/experiments/bm01/comparison.ts";
import { lq08ComparisonIdentity } from "../src/experiments/lq08/comparison.ts";
import { me03ComparisonIdentity } from "../src/experiments/me03/comparison.ts";
import { sr03ComparisonIdentity } from "../src/experiments/sr03/comparison.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function paperCatalogue(root, paperId) {
  const paper = await loadPaperPayload(paperId, root);
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
    await readFile(resolve(root, `content/aliases/${paperId}.yaml`), "utf8"),
  );
  if (raw?.paper !== paperId || !Array.isArray(raw.aliases))
    throw new Error(`Invalid ${paperId} alias collection.`);
  const aliases = raw.aliases.map((value) => {
    const checked = validateAliasRecord(value);
    if (!checked.ok) throw new Error(checked.error);
    return checked.value;
  });
  return { passages, aliases };
}

/** Small public catalogues only. Never read localStorage, notebook files or reader words. */
export async function generateNotebookReplay(
  root = ROOT,
  outputDirectory = resolve(root, "src/generated"),
) {
  const example = JSON.parse(
    await readFile(resolve(root, "src/generated/bm01-comparison.json"), "utf8"),
  );
  const sr03 = JSON.parse(await readFile(resolve(root, "src/generated/sr03-example.json"), "utf8"));
  const lq08 = JSON.parse(await readFile(resolve(root, "src/generated/lq08-example.json"), "utf8"));
  const digests = JSON.parse(
    await readFile(resolve(root, "src/generated/lab-source-digests.json"), "utf8"),
  );
  const massEnergyIdentity = me03ComparisonIdentity({ sourceDigest: digests["me-03"] });
  const identity = bm01ComparisonIdentity(example);
  if (
    [
      identity.sourceDigest,
      sr03.sourceDigest,
      lq08.sourceDigest,
      massEnergyIdentity.sourceDigest,
    ].some((digest) => !/^source:sha256:[a-f0-9]{64}$/u.test(digest))
  )
    throw new Error("Generate the current comparison examples first.");
  const [brownian, relativity, lightQuanta, massEnergy, observerComparisons] = await Promise.all([
    paperCatalogue(root, "brownian-motion"),
    paperCatalogue(root, "special-relativity"),
    paperCatalogue(root, "light-quanta"),
    paperCatalogue(root, "mass-energy"),
    prepareSr03Comparisons(sr03.sourceDigest),
  ]);
  const fixedPair = observerComparisons[0]?.baseline;
  if (
    !Object.hasOwn(brownian.passages, "arg-bm-observable") ||
    !Object.hasOwn(relativity.passages, "arg-sr-rod-events") ||
    !Object.hasOwn(lightQuanta.passages, "arg-lq-photoelectric-energy") ||
    !Object.hasOwn(massEnergy.passages, "arg-me-small-speed") ||
    !fixedPair
  )
    throw new Error("The saved comparisons need their compiled passages and fixed-pair example.");
  // Preserve the existing Brownian payload and return value. Each paper has its own catalogue
  // so a foreign anchor can never appear resolved under the saved paper's URL.
  const output = { identity, ...brownian };
  const observer = {
    identity: sr03ComparisonIdentity(fixedPair),
    ...relativity,
    example: fixedPair,
  };
  const photoelectric = { identity: lq08ComparisonIdentity(lq08), ...lightQuanta };
  const boundaryLedger = { identity: massEnergyIdentity, ...massEnergy };
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(resolve(outputDirectory, "notebook-replay.json"), `${JSON.stringify(output)}\n`);
  await writeFile(
    resolve(outputDirectory, "sr03-notebook-replay.json"),
    `${JSON.stringify(observer)}\n`,
  );
  await writeFile(
    resolve(outputDirectory, "lq08-notebook-replay.json"),
    `${JSON.stringify(photoelectric)}\n`,
  );
  await writeFile(
    resolve(outputDirectory, "me03-notebook-replay.json"),
    `${JSON.stringify(boundaryLedger)}\n`,
  );
  return output;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await generateNotebookReplay();
  console.log(
    JSON.stringify({
      event: "notebook-replay-catalogue-generated",
      papers: ["brownian-motion", "special-relativity", "light-quanta", "mass-energy"],
      passages: Object.keys(result.passages).length,
      sourceDigest: result.identity.sourceDigest,
    }),
  );
}
