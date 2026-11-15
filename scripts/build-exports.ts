/** Publish the actual corpus under /exports/v1/, after prepare:content has succeeded. */
import { mkdir, mkdtemp, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadContentIndex,
  loadPaperPayload,
} from "../src/content/compiler/serverLoaders.ts";
import {
  createLiveExportBundle,
  type ExportProfile,
  type LiveExportBundle,
  type LiveExportInput,
  type LivePaperInput,
} from "../src/content/exports/live.ts";
import { LiveExportError } from "../src/content/exports/sourceProjection.ts";
import { parseReceipt } from "../src/content/provenance/parseReceipt.ts";
import { parseYaml } from "../src/content/provenance/yaml.ts";
import { type Experiment, validateExperiment } from "../src/content/schemas/experiment.ts";
import { REGISTERED_IDS } from "../src/experiments/catalogue.ts";
import { loadBilingualEdition } from "../src/reader/faces/bilingualLoader.ts";
import { loadPaperMargins } from "../src/reader/marginRecords.ts";

export function exportProfile(value: string | undefined): ExportProfile {
  if (value === undefined || value === "scaffold") return "scaffold";
  if (value === "preview" || value === "launch") return value;
  throw new LiveExportError("export-profile-unknown", `Unknown AM_RELEASE_PROFILE ${value}.`);
}

/** Publish at build time, restoring prior subtrees on failure and retaining every generation. */
export async function publishLiveExportBundle(
  root: string,
  bundle: LiveExportBundle,
): Promise<void> {
  const generated = resolve(root, "generated");
  await mkdir(generated, { recursive: true });
  const stage = await mkdtemp(resolve(generated, "exports-build-"));
  for (const file of bundle.files) {
    if (
      !/^\/(?:exports\/v1|schemas\/exports\/v1)\/[a-z0-9/.-]+$/u.test(file.path) ||
      file.path.includes("..")
    ) {
      throw new LiveExportError("export-publication-path", `Invalid public export path ${file.path}.`);
    }
    const destination = resolve(stage, file.path.slice(1));
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, file.text, "utf8");
  }

  // This is a build-time transaction, not an atomic snapshot for concurrent readers.
  const replacements: {
    staged: string;
    destination: string;
    backup: string;
    backedUp: boolean;
    installed: boolean;
  }[] = [];
  try {
    for (const subtree of ["schemas/exports/v1", "exports/v1"]) {
      const replacement = {
        staged: resolve(stage, subtree),
        destination: resolve(root, "public", subtree),
        backup: resolve(stage, "previous", subtree),
        backedUp: false,
        installed: false,
      };
      replacements.push(replacement);
      await mkdir(dirname(replacement.destination), { recursive: true });
      const exists = await stat(replacement.destination).then(
        () => true,
        (error: NodeJS.ErrnoException) => {
          if (error.code === "ENOENT") return false;
          throw error;
        },
      );
      if (exists) {
        await mkdir(dirname(replacement.backup), { recursive: true });
        await rename(replacement.destination, replacement.backup);
        replacement.backedUp = true;
      }
      await rename(replacement.staged, replacement.destination);
      replacement.installed = true;
    }
  } catch (error) {
    const rollbackErrors: unknown[] = [];
    for (const replacement of replacements.reverse()) {
      if (replacement.installed) {
        try {
          await rename(replacement.destination, replacement.staged);
          replacement.installed = false;
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }
      // Preserve both generations if returning the newly installed subtree failed.
      if (replacement.backedUp && !replacement.installed) {
        try {
          await rename(replacement.backup, replacement.destination);
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }
    }
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        `Export publication failed and rollback was incomplete; retained files are in ${stage}.`,
      );
    }
    throw error;
  }
}

/** Shared by the build and corpus tests; never reads browser state or runtime computations. */
export async function loadLiveExportInput(
  root = process.cwd(),
  profileValue = process.env.AM_RELEASE_PROFILE,
): Promise<LiveExportInput> {
  const profile = exportProfile(profileValue);
  const index = await loadContentIndex(root);
  const papers: LivePaperInput[] = [];
  const experiments: Experiment[] = [];
  if (profile === "scaffold") {
    for (const entry of index.payloads.filter((item) => item.kind === "paper")) {
      const payload = await loadPaperPayload(entry.id, root);
      const path = resolve(root, "docs/provenance", `${payload.paper.citation}.md`);
      const receipt = parseReceipt(await readFile(path, "utf8"), path).frontMatter;
      const edition = await loadBilingualEdition(entry.id, root);
      if (!receipt || !edition) {
        throw new LiveExportError(
          "export-source-unavailable",
          `The published paper ${entry.id} lacks its provenance receipt or bilingual source.`,
        );
      }
      papers.push({
        payload,
        receipt,
        edition,
        editorialNotes: loadPaperMargins(entry.id, root).notes,
      });
    }
    const directory = resolve(root, "content/experiments");
    const registered = new Set<string>(REGISTERED_IDS);
    const names = (await readdir(directory))
      .filter((name) => /\.(?:yaml|yml|json)$/u.test(name))
      .sort();
    for (const name of names) {
      const path = resolve(directory, name);
      const text = await readFile(path, "utf8");
      const manifest = validateExperiment(
        name.endsWith(".json") ? JSON.parse(text) : parseYaml(text),
        path,
      );
      if (registered.has(manifest.id)) experiments.push(manifest);
    }
  }
  return { contentRevision: index.buildDigest, profile, papers, experiments };
}

export async function buildExports(
  root = process.cwd(),
  profileValue = process.env.AM_RELEASE_PROFILE,
): Promise<LiveExportBundle> {
  const bundle = createLiveExportBundle(await loadLiveExportInput(root, profileValue));
  await publishLiveExportBundle(root, bundle);
  return bundle;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const bundle = await buildExports();
  console.log(
    `exports: ${bundle.index.files.length} files, ${bundle.index.releaseProfile}, ${bundle.index.contentRevision}`,
  );
}
