/**
 * The Apple App Site Association file for universal links (App plan §8.5; bead
 * am-app-universal-links-re8v): which https://annus-mirabilis.com paths the system hands to the
 * app instead of Safari. The paths come from the pages the app edition carries (its manifest), so
 * the file and the app cannot disagree about what the app can open; embeds and files that are not
 * pages stay in the browser.
 *
 * The file names the app as `<teamId>.<bundleId>`. The team id is the owner's to supply, and until
 * it is, docs/DECISIONS.md records a named placeholder: this generator refuses it by name rather
 * than writing a file that would claim the links for no app. Serving the file on the website
 * (`/.well-known/apple-app-site-association`, JSON, no redirect) and the app's associated-domains
 * entitlement wait on the same team id.
 *
 *   bun scripts/app/association-file.ts [--manifest <edition-manifest.json>] [--out <file>]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { recordedIdentity, TEAM_ID_PLACEHOLDER } from "./identity.ts";

/** The one domain the app claims (D-2026-09-23-app-identity: `applinks:annus-mirabilis.com`). */
export const ASSOCIATED_DOMAIN = "annus-mirabilis.com";
export const APPLINKS_ENTITLEMENT = `applinks:${ASSOCIATED_DOMAIN}`;

export type AssociationErrorCode = "team-id-placeholder" | "team-id-invalid" | "no-pages";

export class AssociationFileError extends Error {
  readonly code: AssociationErrorCode;

  constructor(code: AssociationErrorCode, message: string) {
    super(message);
    this.name = "AssociationFileError";
    this.code = code;
  }
}

/** Extensions of files the site serves that are not pages; the system leaves them to Safari. */
export const NOT_PAGES: readonly string[] = [
  "css",
  "ico",
  "jpg",
  "js",
  "json",
  "map",
  "md",
  "pdf",
  "png",
  "svg",
  "ttf",
  "txt",
  "wasm",
  "webp",
  "woff",
  "woff2",
  "xml",
];

export interface AssociationComponent {
  readonly "/": string;
  readonly exclude?: true;
  readonly comment: string;
}

export interface AssociationFile {
  readonly applinks: {
    readonly details: readonly {
      readonly appIDs: readonly string[];
      readonly components: readonly AssociationComponent[];
    }[];
  };
}

/** The site paths of the edition's HTML pages: `papers/x/index.html` is `/papers/x/`. */
export function editionPages(files: readonly string[]): string[] {
  return files
    .filter((path) => path.endsWith(".html") && path !== "404.html")
    .map((path) =>
      path === "index.html"
        ? "/"
        : path.endsWith("/index.html")
          ? `/${path.slice(0, -"index.html".length)}`
          : `/${path}`,
    )
    .sort();
}

export function associationFile(input: {
  readonly teamId: string;
  readonly bundleId: string;
  readonly pages: readonly string[];
}): AssociationFile {
  if (input.teamId === TEAM_ID_PLACEHOLDER) {
    throw new AssociationFileError(
      "team-id-placeholder",
      `The Apple team id is still the placeholder ${TEAM_ID_PLACEHOLDER} (docs/DECISIONS.md, D-2026-09-23-app-identity). The association file names the app as <teamId>.${input.bundleId}, so it waits for the owner's team id (am-app-apple-account-setup-9xi1).`,
    );
  }
  if (!/^[A-Z0-9]{10}$/.test(input.teamId)) {
    throw new AssociationFileError(
      "team-id-invalid",
      `"${input.teamId}" is not an Apple team id (ten upper-case letters and digits).`,
    );
  }
  if (input.pages.length === 0) {
    throw new AssociationFileError("no-pages", "The edition carries no pages to claim.");
  }
  const sections = [
    ...new Set(
      input.pages
        .filter((page) => page !== "/")
        .map((page) => page.split("/")[1] ?? "")
        // /404/ is the not-found page the export writes, not a place anyone links to.
        .filter((section) => section !== "" && section !== "embed" && section !== "404"),
    ),
  ].sort();
  const components: AssociationComponent[] = [
    {
      "/": "/embed/*",
      exclude: true,
      comment: "An embedded instrument stays in the page that embeds it.",
    },
    ...NOT_PAGES.map(
      (extension): AssociationComponent => ({
        "/": `/*.${extension}`,
        exclude: true,
        comment: "A file, not a page.",
      }),
    ),
    ...(input.pages.includes("/") ? [{ "/": "/", comment: "The home page." }] : []),
    ...sections.map(
      (section): AssociationComponent => ({
        "/": `/${section}/*`,
        comment: `${input.pages.filter((page) => page.startsWith(`/${section}/`)).length} pages the app carries under /${section}/.`,
      }),
    ),
  ];
  return {
    applinks: { details: [{ appIDs: [`${input.teamId}.${input.bundleId}`], components }] },
  };
}

export function associationText(file: AssociationFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

/** Whether the system would hand this path to the app: the first matching component decides. */
export function associationMatches(file: AssociationFile, path: string): boolean {
  for (const detail of file.applinks.details) {
    for (const component of detail.components) {
      if (patternMatches(component["/"], path)) return component.exclude !== true;
    }
  }
  return false;
}

/** Apple's path patterns: `*` is any run of characters, `?` any one. */
function patternMatches(pattern: string, path: string): boolean {
  const source = pattern
    .split("")
    .map((char) =>
      char === "*" ? ".*" : char === "?" ? "." : char.replace(/[.+^${}()|[\]\\]/g, "\\$&"),
    )
    .join("");
  return new RegExp(`^${source}$`).test(path);
}

function main(argv: readonly string[]): number {
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const option = (name: string) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const manifestPath =
    option("--manifest") ?? join(repo, "generated", "app-edition", "edition-manifest.json");
  const identity = recordedIdentity(repo);
  if (identity === null) {
    process.stderr.write("docs/DECISIONS.md has no app-identity block.\n");
    return 2;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    files: { path: string }[];
  };
  try {
    const text = associationText(
      associationFile({
        teamId: identity.teamId,
        bundleId: identity.bundleId,
        pages: editionPages(manifest.files.map((file) => file.path)),
      }),
    );
    const out = option("--out");
    if (out === undefined) process.stdout.write(text);
    else writeFileSync(out, text);
    return 0;
  } catch (error) {
    if (!(error instanceof AssociationFileError)) throw error;
    process.stderr.write(`association file refused (${error.code}): ${error.message}\n`);
    return 2;
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
