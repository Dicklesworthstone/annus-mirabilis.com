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
}

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
    const types = pkgData.licenses
      .map((l: unknown) => (typeof l === "string" ? l : (l as { type?: string } | undefined)?.type))
      .filter(Boolean);
    if (types.length === 1) return types[0];
    if (types.length > 1) return `(${types.join(" OR ")})`;
  }
  if (typeof pkgData.licenses === "string" && pkgData.licenses.trim().length > 0) {
    return pkgData.licenses.trim();
  }
  return "";
}

function findLicenseFile(
  pkgDir: string,
  exists: (p: string) => boolean,
  readText: (p: string) => string | null,
): { licensePath?: string; licenseText?: string } {
  for (const name of LICENSE_FILENAMES) {
    const fullPath = join(pkgDir, name);
    if (exists(fullPath)) {
      const text = readText(fullPath);
      if (text) {
        return { licensePath: fullPath, licenseText: text };
      }
    }
  }
  return {};
}

export function collectNpm(options: CollectNpmOptions): {
  production: LicenseItem[];
  tools: LicenseItem[];
} {
  const { rootDir, packageJson, readText, exists } = options;
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
    const found = findLicenseFile(pkgDir, exists, readText);
    const { licenseText } = found;
    // Record the licence file repo-relative. An absolute path embeds the machine that
    // generated the notices, so the committed THIRD_PARTY_NOTICES.md could never match
    // a regeneration on any other checkout (CI failed with stale-committed-inventory
    // at the first row carrying a File: note).
    const licensePath =
      found.licensePath === undefined ? undefined : relative(rootDir, found.licensePath);

    if (!license && licenseText) {
      if (
        licenseText.includes("MIT License") ||
        licenseText.includes("Permission is hereby granted, free of charge")
      ) {
        license = "MIT";
      } else if (licenseText.includes("Apache License") && licenseText.includes("Version 2.0")) {
        license = "Apache-2.0";
      } else if (
        licenseText.includes("BSD 3-Clause") ||
        licenseText.includes("Redistribution and use in source and binary forms")
      ) {
        license = "BSD-3-Clause";
      } else if (licenseText.includes("ISC License")) {
        license = "ISC";
      }
    }

    if (!license) {
      license = "UNKNOWN";
    }

    const version = pkgData.version || "unknown";
    const relativeSource = `node_modules/${pkgName}`;

    productionItems.set(key, {
      kind: "npm",
      name: pkgName,
      version,
      license,
      source: relativeSource,
      licensePath,
      licenseText,
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
      const lf = findLicenseFile(pkgDir, exists, readText);
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
      licensePath,
      licenseText,
      dependencyChain: [pkg],
    });
  }

  return {
    production: Array.from(productionItems.values()),
    tools: Array.from(toolItems.values()),
  };
}
