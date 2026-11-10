/** Read playback eligibility and scale calibration from the validated instrument manifests. */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateExperiment } from "../src/content/schemas/experiment.ts";
import { strictParse } from "../src/content/schemas/strictParse.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function playbackDeclarations(files) {
  return Object.fromEntries(
    [...files]
      .sort((a, b) => a.file.localeCompare(b.file))
      .map(({ text }) => {
        const manifest = validateExperiment(strictParse(text, "yaml"));
        return [manifest.id, manifest.realRate];
      }),
  );
}

export async function generatePlayback() {
  const folder = resolve(root, "content/experiments");
  const files = await Promise.all(
    (await readdir(folder))
      .filter((name) => name.endsWith(".yaml"))
      .map(async (file) => ({ file, text: await readFile(resolve(folder, file), "utf8") })),
  );
  const declarations = playbackDeclarations(files);
  const out = resolve(root, "src/generated/playback.ts");
  await mkdir(dirname(out), { recursive: true });
  await writeFile(
    out,
    `// Generated from content/experiments/*.yaml by scripts/generate-playback.mjs. Do not edit.
import type { RealRate } from "../content/schemas/experiment.ts";
export const PLAYBACK_MANIFESTS = ${JSON.stringify(declarations, null, 2)} as const satisfies Readonly<Record<string, RealRate>>;
`,
  );
  return {
    manifests: files.length,
    naturalRates: Object.values(declarations).filter((declaration) => declaration.natural).length,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  console.log(JSON.stringify(await generatePlayback()));
