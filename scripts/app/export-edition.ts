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
 * - `bridge-user-script.js`: the native bridge's document-start script, whose
 *   SHA-256 the manifest records; the app injects it only when the digest matches;
 * - `test-console.js`: the test console (src/platform/app-bridge/testConsole.ts),
 *   pinned the same way, which only a DEBUG build injects and only in a UI test;
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
import { readerDataManifest } from "../../src/platform/app-bridge/readerData.ts";
import { SITE_ORIGIN } from "../../src/platform/app-bridge/schemas.ts";
import {
  SETTINGS_SNAPSHOT_PLACEHOLDER,
  SETTINGS_SNAPSHOT_TEMPLATE,
  SITE_TYPE_SIZES,
} from "../../src/platform/app-bridge/settingsSnapshot.ts";
import { TEST_CONSOLE_USER_SCRIPT_SOURCE } from "../../src/platform/app-bridge/testConsole.ts";
import { BRIDGE_USER_SCRIPT_SOURCE } from "../../src/platform/app-bridge/userScripts.ts";
import {
  buildNativeCatalog,
  NATIVE_CATALOG_FILE,
  type NativeCatalog,
  nativeCatalogRoutes,
} from "./native-catalog.ts";
import { editionPageFor, pageAssetReferences, sitemapRoutes } from "./site-routes.ts";

export const EDITION_SCHEMA_VERSION = "annus-mirabilis-app-edition.v1";

/** The bridge user script, written beside the manifest and bundled beside it, never inside Edition/. */
export const BRIDGE_SCRIPT_FILE = "bridge-user-script.js";
export const SETTINGS_SNAPSHOT_FILE = "settings-snapshot.js";
export const TEST_CONSOLE_FILE = "test-console.js";

export type AppExportErrorCode =
  | "no-web-build"
  | "unsafe-edition-path"
  | "edition-over-budget"
  | "catalog-route-missing"
  | "no-route-list"
  | "route-needs-server"
  | "referenced-file-missing";

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
      "Share-card images (opengraph-image, and share/*.png since the cards moved there) are fetched by other sites when a link is shared. Pages name them only in og:image and twitter:image metadata, as absolute https URLs, so no page in the app displays them (App plan §5.2).",
    matches: (path) =>
      /(^|\/)(opengraph-image|twitter-image)(\.[a-z]+)?$/.test(path) ||
      /^share\/[a-z0-9-]+\.png$/.test(path),
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

/** The `count` largest files, biggest first, as "path (N bytes)", for an over-budget refusal. */
export function largestFiles(
  files: readonly { path: string; size: number }[],
  count: number,
): string {
  return [...files]
    .sort((a, b) => b.size - a.size || (a.path < b.path ? -1 : 1))
    .slice(0, count)
    .map((file) => `${file.path} (${file.size} bytes)`)
    .join(", ");
}

export type SiteBinding = {
  readonly commit: string | null;
  readonly binding: "unbound" | "clean-worktree-head";
  readonly reason: string;
};

/**
 * Name the commit that built out/ only when that is the one reading left: the
 * build sits in a clean git worktree and is newer than its HEAD commit. The
 * main checkout is never clean in a shared tree, so an edition exported from
 * it stays unbound, and says why.
 */
export function siteBinding(input: {
  readonly head: string | null;
  readonly clean: boolean | null;
  readonly headCommittedAt: string | null;
  readonly outBuiltAt: Date;
}): SiteBinding {
  const unbound = (reason: string): SiteBinding => ({ commit: null, binding: "unbound", reason });
  if (input.head === null || input.headCommittedAt === null) {
    return unbound("out/ is not inside a git worktree, so no commit can be read for it.");
  }
  if (input.clean !== true) {
    return unbound(
      "The worktree holding out/ has uncommitted changes, so out/ may contain work that no commit records.",
    );
  }
  if (input.outBuiltAt.getTime() < new Date(input.headCommittedAt).getTime()) {
    return unbound(
      "out/ is older than its worktree's HEAD commit, so it was built from an earlier commit.",
    );
  }
  return {
    commit: input.head,
    binding: "clean-worktree-head",
    reason:
      "out/ sits in a clean worktree and was built after that worktree's HEAD commit. Inferred from the tree, not from a release record; the verified app release still checks the release record (App plan §14.3).",
  };
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

/** Every directory the bundled edition needs, parents before children. */
export function editionDirectories(files: readonly { readonly path: string }[]): string[] {
  const directories = new Set<string>();
  for (const file of files) {
    const parts = file.path.split("/").slice(0, -1);
    for (let depth = 1; depth <= parts.length; depth++) {
      directories.add(parts.slice(0, depth).join("/"));
    }
  }
  return [...directories].sort();
}

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

/**
 * The edition needs no server and lacks nothing a page asks for (bead am-app-edition-export-kwpu,
 * requirements 3 and 4). Every route the build's own sitemap lists has its static page in the
 * edition; a route without one would need a server at request time. Every file an included page
 * asks for by src or href is in the build: one excluded by a named rule (a facsimile PDF) is a
 * declared omission, and one that is absent altogether is an omission nothing declares.
 */
export function checkRoutesAndReferences(
  outDir: string,
  paths: readonly string[],
  included: readonly string[],
): void {
  const sitemap = join(outDir, "sitemap.xml");
  let routes: string[] = [];
  try {
    routes = sitemapRoutes(readFileSync(sitemap, "utf8"), SITE_ORIGIN);
  } catch {
    routes = [];
  }
  if (routes.length === 0) {
    throw new AppExportError(
      "no-route-list",
      `${sitemap} is missing or lists no route of ${SITE_ORIGIN}, so the export cannot tell whether every route has a page.`,
    );
  }
  const carried = new Set(included);
  const needServer = routes.filter((route) => !carried.has(editionPageFor(route)));
  if (needServer.length > 0) {
    throw new AppExportError(
      "route-needs-server",
      `${needServer.length} of ${routes.length} route(s) the site lists have no static page in this build, so the app would need a server for them: ${needServer.slice(0, 10).join(", ")}`,
    );
  }
  const inBuild = new Set(paths);
  const absent: string[] = [];
  for (const page of included.filter((path) => path.endsWith(".html"))) {
    for (const file of pageAssetReferences(readFileSync(join(outDir, page), "utf8"))) {
      if (!inBuild.has(file)) absent.push(`${file} (asked for by ${page})`);
    }
  }
  if (absent.length > 0) {
    throw new AppExportError(
      "referenced-file-missing",
      `${absent.length} file(s) a page asks for are not in the build, and no exclusion rule names them: ${absent.slice(0, 10).join("; ")}`,
    );
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
  /** The native screens' data; built from the repository's records when not given. */
  readonly catalog?: NativeCatalog;
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

  checkRoutesAndReferences(outDir, paths, plan.included);

  const catalog = options.catalog ?? buildNativeCatalog(join(repo, "content"));
  const pages = new Set(plan.included);
  const missing = nativeCatalogRoutes(catalog).filter(
    (route) => !pages.has(`${route.slice(1)}index.html`),
  );
  if (missing.length > 0) {
    throw new AppExportError(
      "catalog-route-missing",
      `The app's native screens would open ${missing.length} page(s) this edition does not carry: ${missing.join(", ")}`,
    );
  }
  const catalogText = `${JSON.stringify(catalog, null, 2)}\n`;

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
      `The app edition is ${totalBytes} bytes in ${files.length} files, over the ${budgetBytes}-byte budget (App plan §5.3). Change the budget only with a recorded measurement. Largest files: ${largestFiles(files, 10)}`,
    );
  }

  const outMtime = statSync(indexHtml).mtime;
  const sourceTree = git(outDir, ["rev-parse", "--show-toplevel"]);
  const sourceHead = sourceTree === null ? null : git(sourceTree, ["rev-parse", "HEAD"]);
  const sourceHeadDate =
    sourceTree === null ? null : git(sourceTree, ["log", "-1", "--format=%cI", "HEAD"]);
  const porcelain = sourceTree === null ? null : git(sourceTree, ["status", "--porcelain"]);
  const binding = siteBinding({
    head: sourceHead,
    clean: porcelain === null ? null : porcelain === "",
    headCommittedAt: sourceHeadDate,
    outBuiltAt: outMtime,
  });
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
      ...binding,
      sourceTree,
      sourceHeadCommittedAt: sourceHeadDate,
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
    userScripts: [
      {
        id: "bridge",
        file: BRIDGE_SCRIPT_FILE,
        sha256: createHash("sha256").update(BRIDGE_USER_SCRIPT_SOURCE).digest("hex"),
        bytes: Buffer.byteLength(BRIDGE_USER_SCRIPT_SOURCE),
      },
      {
        // Injected first. The app replaces the placeholder with the settings' JSON and nothing else.
        id: "settings-snapshot",
        file: SETTINGS_SNAPSHOT_FILE,
        sha256: createHash("sha256").update(SETTINGS_SNAPSHOT_TEMPLATE).digest("hex"),
        bytes: Buffer.byteLength(SETTINGS_SNAPSHOT_TEMPLATE),
        placeholder: SETTINGS_SNAPSHOT_PLACEHOLDER,
      },
      {
        // A UI test's evidence (bead am-app-test-harness-da6e): injected only by a DEBUG build.
        id: "test-console",
        file: TEST_CONSOLE_FILE,
        sha256: createHash("sha256").update(TEST_CONSOLE_USER_SCRIPT_SOURCE).digest("hex"),
        bytes: Buffer.byteLength(TEST_CONSOLE_USER_SCRIPT_SOURCE),
        debugOnly: true,
      },
    ],
    // The site's type-size steps, which the app maps the reader's system text size onto.
    settings: { typeSizes: SITE_TYPE_SIZES },
    // The site's registry, so the app lists and exports the reader's data with /your-data/'s labels.
    readerData: readerDataManifest(),
    // The library, outlines, Discover routes and lab catalogue the native screens show.
    nativeCatalog: {
      file: NATIVE_CATALOG_FILE,
      sha256: createHash("sha256").update(catalogText).digest("hex"),
      bytes: Buffer.byteLength(catalogText),
    },
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
  writeFileSync(join(dest, BRIDGE_SCRIPT_FILE), BRIDGE_USER_SCRIPT_SOURCE);
  writeFileSync(join(dest, SETTINGS_SNAPSHOT_FILE), SETTINGS_SNAPSHOT_TEMPLATE);
  writeFileSync(join(dest, TEST_CONSOLE_FILE), TEST_CONSOLE_USER_SCRIPT_SOURCE);
  writeFileSync(join(dest, NATIVE_CATALOG_FILE), catalogText);
  // The bundling phase reads out/ from wherever this export read it, not only the main checkout.
  writeFileSync(join(dest, "edition-source.txt"), `${outDir}\n`);
  writeFileSync(
    join(dest, "edition-inputs.xcfilelist"),
    `${[
      "$(SRCROOT)/../generated/app-edition/edition-manifest.json",
      "$(SRCROOT)/../generated/app-edition/edition.sha256",
      "$(SRCROOT)/../generated/app-edition/edition-files.txt",
      `$(SRCROOT)/../generated/app-edition/${BRIDGE_SCRIPT_FILE}`,
      `$(SRCROOT)/../generated/app-edition/${SETTINGS_SNAPSHOT_FILE}`,
      `$(SRCROOT)/../generated/app-edition/${TEST_CONSOLE_FILE}`,
      `$(SRCROOT)/../generated/app-edition/${NATIVE_CATALOG_FILE}`,
      "$(SRCROOT)/../generated/app-edition/edition-source.txt",
      ...files.map((file) => `${outDir}/${file.path}`),
    ].join("\n")}\n`,
  );
  const bundled = "$(TARGET_BUILD_DIR)/$(UNLOCALIZED_RESOURCES_FOLDER_PATH)";
  writeFileSync(
    join(dest, "edition-outputs.xcfilelist"),
    `${[
      `${bundled}/edition-manifest.json`,
      `${bundled}/${BRIDGE_SCRIPT_FILE}`,
      `${bundled}/${SETTINGS_SNAPSHOT_FILE}`,
      `${bundled}/${TEST_CONSOLE_FILE}`,
      `${bundled}/${NATIVE_CATALOG_FILE}`,
      `${bundled}/Edition`,
      // The script sandbox grants writes only to declared outputs, directories included.
      ...editionDirectories(files).map((directory) => `${bundled}/Edition/${directory}`),
      ...files.map((file) => `${bundled}/Edition/${file.path}`),
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
