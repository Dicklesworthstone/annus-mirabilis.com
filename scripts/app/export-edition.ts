/**
 * Export the iPhone app's edition from the web build (App plan §5).
 *
 * Reads the static export in `out/` and never builds it: builds belong to the
 * orchestrator, and the app ships the same bytes the website serves. Writes to
 * the gitignored `generated/app-edition/`:
 *
 * - `edition-manifest.json`: every shipped file with path, SHA-256, size and
 *   content type, the declared exclusions with their reasons, the size budget,
 *   and what the export can and cannot say about which commit built `out/`;
 * - `edition.sha256`: the same digests in `shasum -c` form, relative to `out/`,
 *   which the Xcode bundling phase checks twice (source still matches, bundle
 *   matches);
 * - `edition-files.txt`: the list `rsync --files-from` copies;
 * - `edition-inputs.xcfilelist` and `edition-outputs.xcfilelist`: the bundling
 *   phase's declared inputs and outputs, so user-script sandboxing stays on.
 *
 * Usage: `bun scripts/app/export-edition.ts [--out <dir>] [--dest <dir>]`
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const EDITION_SCHEMA_VERSION = "annus-mirabilis-app-edition.v1";

export type AppExportErrorCode = "no-web-build" | "unsafe-edition-path" | "edition-over-budget";

/** A refusal of the export, with a code a caller or a test can branch on. */
export class AppExportError extends Error {
  readonly code: AppExportErrorCode;

  constructor(code: AppExportErrorCode, message: string) {
    super(message);
    this.name = "AppExportError";
    this.code = code;
  }
}

/**
 * App plan §5.3 proposed 80 MB, provisional, "adjusted only with a recorded
 * measurement". Measured 2026-09-23 on the export of 2026-09-22: 87,384,748
 * bytes in 842 files after the exclusions below, of which the offline chapters
 * are 11.2 MB. The plan also lists those chapters as an exclusion, but 334 of
 * the 358 pages link to /offline/, so dropping them would put a dead link on
 * nearly every page until the bridge can hide that action. They ship, and the
 * budget is 100 MB until a measurement moves it again.
 */
export const EDITION_BUDGET_BYTES = 100_000_000;

/** One fixed table, so the scheme handler never guesses a type (App plan §6.2). */
export const CONTENT_TYPES: Readonly<Record<string, string>> = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  xml: "application/xml",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  ico: "image/x-icon",
  wasm: "application/wasm",
  woff2: "font/woff2",
  woff: "font/woff",
  ttf: "font/ttf",
  otf: "font/otf",
  pdf: "application/pdf",
  webmanifest: "application/manifest+json",
  map: "application/json",
};

export const OCTET_STREAM = "application/octet-stream";

export function contentTypeFor(path: string): string {
  const base = path.slice(path.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  if (dot <= 0) {
    return OCTET_STREAM;
  }
  return CONTENT_TYPES[base.slice(dot + 1).toLowerCase()] ?? OCTET_STREAM;
}

const DIGEST_DIRECTORY = /^edition\/([0-9a-f]{64})\//;
const DIGEST_REFERENCE = /edition\/([0-9a-f]{64})/g;
const SCANNED_FOR_REFERENCES = /\.(html|js|mjs|json|css|txt|md)$/;

export type ExclusionRule = {
  readonly id: string;
  readonly reason: string;
  readonly matches: (path: string, context: PlanContext) => boolean;
};

export type PlanContext = {
  readonly paths: ReadonlySet<string>;
  readonly referencedDigests: ReadonlySet<string>;
};

/**
 * The declared exclusions (App plan §5.2). Each names what it drops and why;
 * everything else in `out/` ships, so a new kind of file is bundled by default
 * rather than dropped silently.
 */
export const EXCLUSION_RULES: readonly ExclusionRule[] = [
  {
    id: "facsimile-pdf",
    reason:
      "Facsimile PDFs are never bundled; the app downloads a pinned facsimile only when the reader asks (App plan §5.3, §8.8).",
    matches: (path) => path.startsWith("papers/pdfs/") && path.endsWith(".pdf"),
  },
  {
    id: "flight-payload",
    reason:
      "React flight payloads serve next/link client navigation, which one component uses (the facsimile face). When a payload is missing, Next loads the document instead, and the edition links with plain anchors everywhere else.",
    matches: (path, context) => {
      if (!(path === "index.txt" || path.endsWith("/index.txt"))) {
        return false;
      }
      return context.paths.has(`${path.slice(0, -"index.txt".length)}index.html`);
    },
  },
  {
    id: "unreferenced-edition-digest",
    reason:
      "public/edition/ keeps one content-addressed directory per content build. A page can reach only a digest it names, so digests no shipped page names are leftovers from earlier builds.",
    matches: (path, context) => {
      const match = DIGEST_DIRECTORY.exec(path);
      return match !== null && !context.referencedDigests.has(match[1] ?? "");
    },
  },
  {
    id: "crawler-file",
    reason:
      "robots.txt and sitemap.xml are read by search crawlers, never by the app (App plan §5.2).",
    matches: (path) => path === "robots.txt" || path === "sitemap.xml",
  },
  {
    id: "share-card-image",
    reason:
      "Share-card images are fetched by other sites when a link is shared; no page in the app displays them (App plan §5.2).",
    matches: (path) => /(^|\/)(opengraph-image|twitter-image)(\.[a-z]+)?$/.test(path),
  },
  {
    id: "finder-metadata",
    reason: "macOS Finder metadata, not part of the edition.",
    matches: (path) => path === ".DS_Store" || path.endsWith("/.DS_Store"),
  },
];

/**
 * Digests named by any file outside a digest directory, then closed over
 * digests named from inside a kept digest directory.
 */
export function referencedDigests(
  paths: readonly string[],
  readText: (path: string) => string,
): Set<string> {
  const kept = new Set<string>();
  const scan = (path: string) => {
    for (const match of readText(path).matchAll(DIGEST_REFERENCE)) {
      const digest = match[1];
      if (digest !== undefined) {
        kept.add(digest);
      }
    }
  };
  for (const path of paths) {
    if (SCANNED_FOR_REFERENCES.test(path) && !DIGEST_DIRECTORY.test(path)) {
      scan(path);
    }
  }
  const scanned = new Set<string>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const digest of [...kept]) {
      if (scanned.has(digest)) {
        continue;
      }
      scanned.add(digest);
      const before = kept.size;
      for (const path of paths) {
        if (path.startsWith(`edition/${digest}/`) && SCANNED_FOR_REFERENCES.test(path)) {
          scan(path);
        }
      }
      if (kept.size > before) {
        grew = true;
      }
    }
  }
  return kept;
}

export type EditionPlan = {
  readonly included: readonly string[];
  readonly excluded: ReadonlyMap<string, readonly string[]>;
};

export function planEdition(paths: readonly string[], digests: ReadonlySet<string>): EditionPlan {
  const context: PlanContext = { paths: new Set(paths), referencedDigests: digests };
  const included: string[] = [];
  const excluded = new Map<string, string[]>();
  for (const path of [...paths].sort()) {
    const rule = EXCLUSION_RULES.find((candidate) => candidate.matches(path, context));
    if (rule === undefined) {
      included.push(path);
    } else {
      const list = excluded.get(rule.id) ?? [];
      list.push(path);
      excluded.set(rule.id, list);
    }
  }
  return { included, excluded };
}

/** Characters Xcode's file lists or `shasum -c` would misread. */
export function unsafePathReason(path: string): string | null {
  if (path.includes("$")) {
    return "contains '$', which Xcode expands as a build setting in a file list";
  }
  if (/[\n\r\\]/.test(path)) {
    return "contains a newline or backslash, which shasum -c escapes";
  }
  return null;
}

export type EditionFile = {
  readonly path: string;
  readonly sha256: string;
  readonly size: number;
  readonly contentType: string;
};

/** Digest over the sorted file table, so identical bytes give an identical edition id. */
export function editionDigest(files: readonly EditionFile[]): string {
  const hash = createHash("sha256");
  for (const file of [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    hash.update(`${file.path}\0${file.sha256}\0${file.size}\n`);
  }
  return hash.digest("hex");
}

function walk(root: string): string[] {
  const out: string[] = [];
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(full);
      } else if (entry.isFile()) {
        out.push(relative(root, full).split("\\").join("/"));
      }
    }
  };
  visit(root);
  return out;
}

function git(repo: string, args: readonly string[]): string | null {
  try {
    return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function nextBuildId(outDir: string): string | null {
  const staticDir = join(outDir, "_next", "static");
  try {
    const ids = readdirSync(staticDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !["chunks", "css", "media"].includes(entry.name))
      .map((entry) => entry.name);
    return ids.length === 1 ? (ids[0] ?? null) : null;
  } catch {
    return null;
  }
}

export type ExportResult = {
  readonly manifestPath: string;
  readonly fileCount: number;
  readonly totalBytes: number;
  readonly excludedCount: number;
  readonly editionDigest: string;
};

export function exportEdition(options: {
  readonly repo: string;
  readonly outDir: string;
  readonly dest: string;
  readonly budgetBytes?: number;
}): ExportResult {
  const { repo, outDir, dest } = options;
  const budgetBytes = options.budgetBytes ?? EDITION_BUDGET_BYTES;
  const indexHtml = join(outDir, "index.html");
  try {
    statSync(indexHtml);
  } catch {
    throw new AppExportError(
      "no-web-build",
      `No web build at ${outDir}: ${indexHtml} is missing. The app edition is exported from a finished build.`,
    );
  }

  const paths = walk(outDir);
  const unsafe = paths
    .map((path) => [path, unsafePathReason(path)] as const)
    .filter(([, reason]) => reason !== null);
  if (unsafe.length > 0) {
    throw new AppExportError(
      "unsafe-edition-path",
      `Refusing ${unsafe.length} path(s) the bundling phase cannot carry: ${unsafe.map(([p, r]) => `${p} (${r})`).join("; ")}`,
    );
  }

  const digests = referencedDigests(paths, (path) => readFileSync(join(outDir, path), "utf8"));
  const plan = planEdition(paths, digests);

  const files: EditionFile[] = plan.included.map((path) => {
    const bytes = readFileSync(join(outDir, path));
    return {
      path,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      size: bytes.byteLength,
      contentType: contentTypeFor(path),
    };
  });
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const untyped = files
    .filter((file) => file.contentType === OCTET_STREAM)
    .map((file) => file.path);

  if (totalBytes > budgetBytes) {
    throw new AppExportError(
      "edition-over-budget",
      `The app edition is ${totalBytes} bytes in ${files.length} files, over the ${budgetBytes}-byte budget (App plan §5.3). Change the budget only with a recorded measurement.`,
    );
  }

  const outMtime = statSync(indexHtml).mtime;
  const head = git(repo, ["rev-parse", "HEAD"]);
  const headDate = git(repo, ["log", "-1", "--format=%cI", "HEAD"]);
  const digest = editionDigest(files);

  const manifest = {
    schemaVersion: EDITION_SCHEMA_VERSION,
    editionDigest: digest,
    source: {
      dir: relative(repo, outDir) || ".",
      nextBuildId: nextBuildId(outDir),
      indexHtmlModifiedAt: outMtime.toISOString(),
    },
    site: {
      commit: null,
      binding: "unbound",
      reason:
        "The static export records no commit and no web release record exists for it yet, so this edition cannot name the commit that built it. The verified app release binds it (App plan §14.3).",
      gitHeadAtExport: head,
      gitHeadCommittedAt: headDate,
      exportOlderThanHead:
        headDate === null ? null : outMtime.getTime() < new Date(headDate).getTime(),
    },
    budget: { maxBytes: budgetBytes, totalBytes, fileCount: files.length },
    exclusions: EXCLUSION_RULES.map((rule) => {
      const dropped = plan.excluded.get(rule.id) ?? [];
      return {
        rule: rule.id,
        reason: rule.reason,
        files: dropped.length,
        bytes: dropped.reduce((sum, path) => sum + statSync(join(outDir, path)).size, 0),
      };
    }),
    untypedFiles: untyped,
    files,
  };

  mkdirSync(dest, { recursive: true });
  const manifestPath = join(dest, "edition-manifest.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(
    join(dest, "edition.sha256"),
    files.map((file) => `${file.sha256}  ${file.path}\n`).join(""),
  );
  writeFileSync(join(dest, "edition-files.txt"), files.map((file) => `${file.path}\n`).join(""));
  const outFromIos = relative(join(repo, "ios"), outDir).split("\\").join("/");
  writeFileSync(
    join(dest, "edition-inputs.xcfilelist"),
    `${[
      "$(SRCROOT)/../generated/app-edition/edition-manifest.json",
      "$(SRCROOT)/../generated/app-edition/edition.sha256",
      "$(SRCROOT)/../generated/app-edition/edition-files.txt",
      ...files.map((file) => `$(SRCROOT)/${outFromIos}/${file.path}`),
    ].join("\n")}\n`,
  );
  writeFileSync(
    join(dest, "edition-outputs.xcfilelist"),
    `${[
      "$(TARGET_BUILD_DIR)/$(UNLOCALIZED_RESOURCES_FOLDER_PATH)/edition-manifest.json",
      ...files.map(
        (file) => `$(TARGET_BUILD_DIR)/$(UNLOCALIZED_RESOURCES_FOLDER_PATH)/Edition/${file.path}`,
      ),
    ].join("\n")}\n`,
  );

  return {
    manifestPath,
    fileCount: files.length,
    totalBytes,
    excludedCount: [...plan.excluded.values()].reduce((sum, list) => sum + list.length, 0),
    editionDigest: digest,
  };
}

function main(argv: readonly string[]): number {
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const flag = (name: string) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const outDir = resolve(repo, flag("--out") ?? "out");
  const dest = resolve(repo, flag("--dest") ?? "generated/app-edition");
  try {
    const result = exportEdition({ repo, outDir, dest });
    process.stdout.write(
      `app edition: ${result.fileCount} files, ${result.totalBytes} bytes, ${result.excludedCount} excluded, digest ${result.editionDigest}\n${result.manifestPath}\n`,
    );
    return 0;
  } catch (error) {
    const code = error instanceof AppExportError ? ` [${error.code}]` : "";
    process.stderr.write(
      `export-edition${code}: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    return 1;
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
