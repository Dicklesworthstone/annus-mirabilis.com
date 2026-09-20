/**
 * Collect NPM Dependencies and Licenses.
 * Bead: am-gov-license-inventory-w6yz
 */

import { join, relative } from "node:path";
import type { LicenseItem } from "./types.ts";

export interface CollectNpmOptions {
  readonly rootDir: string;
  readonly packageJson: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  readonly readText: (path: string) => string | null;
  readonly exists: (path: string) => boolean;
  /** Entry names of one directory, or [] when it does not exist. */
  readonly listDir: (dir: string) => readonly string[];
}

/**
 * Compared case-insensitively against the real directory entries, never probed by
 * name. `next` ships `license.md`; a case-insensitive macOS filesystem answers a
 * probe for `LICENSE.md` while Linux does not, so name probing recorded a
 * different row on each platform and the committed notices could never match a
 * regeneration in CI (stale-committed-inventory at the `next` row).
 */
const LICENSE_FILENAMES = [
  "LICENSE",
  "LICENSE.md",
  "LICENSE.txt",
  "LICENCE",
  "LICENCE.md",
  "LICENCE.txt",
  "COPYING",
  "COPYING.txt",
];

function extractLicenseFromPkgJson(pkgData: Record<string, unknown>): string {
  if (typeof pkgData.license === "string" && pkgData.license.trim().length > 0) {
    return pkgData.license.trim();
  }
  if (Array.isArray(pkgData.licenses) && pkgData.licenses.length > 0) {
    const types: string[] = [];
    for (const l of pkgData.licenses) {
      if (typeof l === "string" && l.trim().length > 0) {
        types.push(l.trim());
      } else if (
        typeof l === "object" &&
        l !== null &&
        "type" in l &&
        typeof l.type === "string" &&
        l.type.trim().length > 0
      ) {
        types.push(l.type.trim());
      }
    }
    if (types.length === 1 && types[0] !== undefined) return types[0];
    if (types.length > 1) return `(${types.join(" OR ")})`;
  }
  if (typeof pkgData.licenses === "string" && pkgData.licenses.trim().length > 0) {
    return pkgData.licenses.trim();
  }
  return "";
}

function findLicenseFile(
  pkgDir: string,
  listDir: (dir: string) => readonly string[],
  readText: (p: string) => string | null,
): { licensePath?: string; licenseText?: string } {
  const entries = [...listDir(pkgDir)].sort();
  for (const name of LICENSE_FILENAMES) {
    const entry = entries.find((candidate) => candidate.toLowerCase() === name.toLowerCase());
    if (entry === undefined) continue;
    const fullPath = join(pkgDir, entry);
    const text = readText(fullPath);
    if (text) {
      return { licensePath: fullPath, licenseText: text };
    }
  }
  return {};
}

/**
 * am-o44v. Last-resort licence identification from the licence TEXT, used only when a package
 * declares no license field. It classified by substring, and one of those substrings is shared:
 * "Redistribution and use in source and binary forms" opens BSD-2-Clause as well as BSD-3-Clause.
 * The clause that distinguishes them is the third one, "Neither the name ... may be used to
 * endorse". Without it the old code still answered BSD-3-Clause.
 *
 * Measured on an installed package: node_modules/entities declares BSD-2-Clause, its LICENSE has
 * the shared opening and no third clause, and this function used to call it BSD-3-Clause. Latent
 * rather than live only because entities declares its licence, so the fallback is not reached.
 *
 * Where the text cannot distinguish, this now returns undefined so the caller records UNKNOWN. A
 * licence is a rights claim: an honest unknown is correct where a confident wrong answer is not,
 * and refusing asserts nothing new.
 */
export function licenseFromText(licenseText: string): string | undefined {
  if (
    licenseText.includes("MIT License") ||
    licenseText.includes("Permission is hereby granted, free of charge")
  ) {
    return "MIT";
  }
  if (licenseText.includes("Apache License") && licenseText.includes("Version 2.0")) {
    return "Apache-2.0";
  }
  if (licenseText.includes("ISC License")) {
    return "ISC";
  }
  if (licenseText.includes("BSD 3-Clause")) {
    return "BSD-3-Clause";
  }
  if (licenseText.includes("Redistribution and use in source and binary forms")) {
    // Shared by the 2-, 3- and 4-clause BSD families. Only the third clause separates them.
    const hasThirdClause =
      licenseText.includes("Neither the name") || licenseText.includes("neither the name");
    return hasThirdClause ? "BSD-3-Clause" : undefined;
  }
  return undefined;
}

export function collectNpm(options: CollectNpmOptions): {
  production: LicenseItem[];
  tools: LicenseItem[];
} {
  const { rootDir, packageJson, readText, exists, listDir } = options;
  const productionItems = new Map<string, LicenseItem>();
  const toolItems = new Map<string, LicenseItem>();

  const visitedProduction = new Set<string>();

  function resolvePackageDir(pkgName: string, fromDir?: string): string | null {
    // 1. Check local node_modules from fromDir
    if (fromDir) {
      let cur = fromDir;
      while (cur.startsWith(rootDir)) {
        const candidate = join(cur, "node_modules", pkgName);
        if (exists(candidate)) return candidate;
        const parent = join(cur, "..");
        if (parent === cur) break;
        cur = parent;
      }
    }
    // 2. Check root node_modules
    const rootCandidate = join(rootDir, "node_modules", pkgName);
    if (exists(rootCandidate)) return rootCandidate;
    return null;
  }

  function walkProduction(pkgName: string, chain: string[]): void {
    const key = pkgName;
    if (visitedProduction.has(key)) return;
    visitedProduction.add(key);

    const currentChain = [...chain, pkgName];
    const pkgDir = resolvePackageDir(pkgName);

    if (!pkgDir) {
      productionItems.set(key, {
        kind: "npm",
        name: pkgName,
        version: "unknown",
        license: "UNKNOWN",
        source: `node_modules/${pkgName}`,
        dependencyChain: currentChain,
      });
      return;
    }

    const pkgJsonPath = join(pkgDir, "package.json");
    let pkgData: Record<string, unknown> = {};
    if (exists(pkgJsonPath)) {
      try {
        const text = readText(pkgJsonPath);
        if (text) pkgData = JSON.parse(text);
      } catch {
        // malformed package.json
      }
    }

    let license = extractLicenseFromPkgJson(pkgData);
    const found = findLicenseFile(pkgDir, listDir, readText);
    const { licenseText } = found;
    // Record the licence file repo-relative. An absolute path embeds the machine that
    // generated the notices, so the committed THIRD_PARTY_NOTICES.md could never match
    // a regeneration on any other checkout (CI failed with stale-committed-inventory
    // at the first row carrying a File: note).
    const licensePath =
      found.licensePath === undefined ? undefined : relative(rootDir, found.licensePath);

    if (!license && licenseText) {
      license = licenseFromText(licenseText) ?? "";
    }

    if (!license) {
      license = "UNKNOWN";
    }

    const version =
      typeof pkgData.version === "string" && pkgData.version.length > 0
        ? pkgData.version
        : "unknown";
    const relativeSource = `node_modules/${pkgName}`;

    productionItems.set(key, {
      kind: "npm",
      name: pkgName,
      version,
      license,
      source: relativeSource,
      ...(licensePath !== undefined ? { licensePath } : {}),
      ...(licenseText !== undefined ? { licenseText } : {}),
      dependencyChain: currentChain,
    });

    const subDeps = pkgData.dependencies || {};
    for (const subDep of Object.keys(subDeps)) {
      walkProduction(subDep, currentChain);
    }
  }

  // Walk all production dependencies
  const directProd = packageJson.dependencies || {};
  for (const pkg of Object.keys(directProd)) {
    walkProduction(pkg, []);
  }

  // Collect devDependencies as tools
  const devDeps = packageJson.devDependencies || {};
  for (const pkg of Object.keys(devDeps)) {
    const pkgDir = resolvePackageDir(pkg);
    let version = "unknown";
    let license = "UNKNOWN";
    let licensePath: string | undefined;
    let licenseText: string | undefined;

    if (pkgDir) {
      const pkgJsonPath = join(pkgDir, "package.json");
      if (exists(pkgJsonPath)) {
        try {
          const text = readText(pkgJsonPath);
          if (text) {
            const data = JSON.parse(text);
            version = data.version || "unknown";
            license = extractLicenseFromPkgJson(data) || "UNKNOWN";
          }
        } catch {
          // ignore
        }
      }
      const lf = findLicenseFile(pkgDir, listDir, readText);
      // Repo-relative for the same reason as the production branch above.
      licensePath = lf.licensePath === undefined ? undefined : relative(rootDir, lf.licensePath);
      licenseText = lf.licenseText;
    }

    toolItems.set(pkg, {
      kind: "tool",
      name: pkg,
      version,
      license,
      source: `node_modules/${pkg}`,
      ...(licensePath !== undefined ? { licensePath } : {}),
      ...(licenseText !== undefined ? { licenseText } : {}),
      dependencyChain: [pkg],
    });
  }

  return {
    production: Array.from(productionItems.values()),
    tools: Array.from(toolItems.values()),
  };
}
