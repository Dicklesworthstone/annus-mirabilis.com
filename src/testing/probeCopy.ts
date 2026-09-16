import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

export const FRANKENSIM_PIN = "5bbbfae6f7de614422f6f97f5798a3e00f8ad813";
export const ASUPERSYNC_PIN = "5adf01082b14de1d7bd2c9d9da9779d5502cb4bc";

export const REQUIRED_SIBLINGS = [
  "asupersync",
  "franken_networkx",
  "franken_numpy",
  "frankenscipy",
  "frankensqlite",
  "frankentorch",
] as const;

export type RequiredSibling = (typeof REQUIRED_SIBLINGS)[number];

export type DocumentedExclusion = {
  sibling: string;
  reason: string;
};

/**
 * Withdrawn 2026-09-16. Optional path deps still have to exist on disk:
 * rch RCH-E415 named frankentorch/crates/ft-autograd while loading fs-ad.
 * A sibling is excluded only with live proof that cargo and rch can load
 * the workspace without it.
 */
export const DOCUMENTED_EXCLUSIONS: readonly DocumentedExclusion[] = [];

export const WITHDRAWN_EXCLUSIONS: readonly DocumentedExclusion[] = [
  {
    sibling: "frankentorch",
    reason:
      "Withdrawn: RCH-E415 on 2026-09-16, logRunId 20260916T054234Z-b95b76ff. fs-ad marks ft-autograd optional, but cargo path materialization still requires the directory.",
  },
];

export type PathDep = {
  manifest: string;
  pathSpec: string;
  sibling: string;
  optional: boolean;
};

export type SiblingNeed = {
  name: string;
  required: boolean;
  optionalOnly: boolean;
  manifests: string[];
};

export type CopyCheck = {
  ok: boolean;
  present: string[];
  missingRequired: string[];
  missingOptionalDocumented: string[];
  missingUndocumented: string[];
  missingManifests: string[];
};

const INLINE_PATH_TABLE = /\{[^{}]*path\s*=\s*"([^"]+)"[^{}]*\}/g;
const OPTIONAL_TRUE = /optional\s*=\s*true/;

export function isRequiredSibling(name: string): name is RequiredSibling {
  return (REQUIRED_SIBLINGS as readonly string[]).includes(name);
}

export function documentedExclusion(name: string): DocumentedExclusion | undefined {
  return DOCUMENTED_EXCLUSIONS.find((row) => row.sibling === name);
}

/** Naive first-wave sibling list from the 2026-09-15 probe. Omits frankensqlite. */
export const INCOMPLETE_20260915_SIBLINGS = [
  "asupersync",
  "franken_networkx",
  "franken_numpy",
  "frankenscipy",
] as const;

export function parsePathEntries(text: string): Array<{ pathSpec: string; optional: boolean }> {
  const entries: Array<{ pathSpec: string; optional: boolean }> = [];
  for (const match of text.matchAll(INLINE_PATH_TABLE)) {
    const pathSpec = match[1];
    if (pathSpec === undefined) continue;
    entries.push({ pathSpec, optional: OPTIONAL_TRUE.test(match[0]) });
  }
  return entries;
}

export function siblingFromResolved(frankensimRoot: string, resolved: string): string | null {
  const root = resolve(frankensimRoot);
  const abs = resolve(resolved);
  const relToRoot = relative(root, abs);
  if (!relToRoot.startsWith(`..${sep}`) && relToRoot !== "..") return null;
  const parent = dirname(root);
  const relToParent = relative(parent, abs);
  if (relToParent.startsWith(`..${sep}`) || relToParent === "..") return null;
  const name = relToParent.split(/[/\\]/)[0];
  if (name === undefined || name === "" || name === basename(root)) return null;
  return name;
}

export function discoverPathDeps(frankensimRoot: string): PathDep[] {
  const root = resolve(frankensimRoot);
  const deps: PathDep[] = [];
  for (const manifest of listCargoTomls(root)) {
    const text = readFileSync(manifest, "utf8");
    const relManifest = relative(root, manifest).split(sep).join("/");
    for (const entry of parsePathEntries(text)) {
      const resolved = resolve(dirname(manifest), entry.pathSpec);
      const sibling = siblingFromResolved(root, resolved);
      if (sibling === null) continue;
      deps.push({
        manifest: relManifest,
        pathSpec: entry.pathSpec,
        sibling,
        optional: entry.optional,
      });
    }
  }
  return deps;
}

export function siblingNeeds(deps: readonly PathDep[]): SiblingNeed[] {
  const byName = new Map<string, PathDep[]>();
  for (const dep of deps) {
    const rows = byName.get(dep.sibling) ?? [];
    rows.push(dep);
    byName.set(dep.sibling, rows);
  }
  return [...byName.entries()]
    .map(([name, rows]) => {
      const requiredHit = rows.some((row) => !row.optional);
      return {
        name,
        required: requiredHit || isRequiredSibling(name),
        optionalOnly: rows.every((row) => row.optional),
        manifests: [...new Set(rows.map((row) => row.manifest))].sort(),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function requiredSiblingNames(deps: readonly PathDep[]): string[] {
  const names = new Set<string>(REQUIRED_SIBLINGS);
  for (const need of siblingNeeds(deps)) {
    if (need.required) names.add(need.name);
  }
  for (const exclusion of DOCUMENTED_EXCLUSIONS) names.delete(exclusion.sibling);
  return [...names].sort();
}

export function checkProbeCopy(buildRoot: string, deps: readonly PathDep[]): CopyCheck {
  const root = resolve(buildRoot);
  const required = requiredSiblingNames(deps);
  const present: string[] = [];
  const missingRequired: string[] = [];
  const missingOptionalDocumented: string[] = [];
  const missingUndocumented: string[] = [];
  const missingManifests: string[] = [];

  for (const name of required) {
    const dest = join(root, name);
    if (existsSync(dest) && statSync(dest).isDirectory()) present.push(name);
    else missingRequired.push(name);
  }

  const discovered = siblingNeeds(deps);
  for (const need of discovered) {
    const dest = join(root, need.name);
    const exists = existsSync(dest) && statSync(dest).isDirectory();
    if (exists) {
      if (!present.includes(need.name)) present.push(need.name);
      continue;
    }
    if (required.includes(need.name)) continue;
    const exclusion = documentedExclusion(need.name);
    if (exclusion) missingOptionalDocumented.push(need.name);
    else missingUndocumented.push(need.name);
  }

  for (const dep of deps) {
    if (!required.includes(dep.sibling) && documentedExclusion(dep.sibling)) continue;
    const dest = resolve(join(root, "frankensim"), dirname(dep.manifest), dep.pathSpec, "Cargo.toml");
    if (!existsSync(dest)) missingManifests.push(`${dep.sibling} via ${dep.manifest} -> ${dep.pathSpec}`);
  }

  present.sort();
  missingRequired.sort();
  missingOptionalDocumented.sort();
  missingUndocumented.sort();
  missingManifests.sort();

  return {
    ok: missingRequired.length === 0 && missingUndocumented.length === 0 && missingManifests.length === 0,
    present,
    missingRequired,
    missingOptionalDocumented,
    missingUndocumented,
    missingManifests,
  };
}

export type FailureClass = "absent-sibling" | "toolchain-lld" | "other";

const ABSENT_SIBLING_MARKERS = [
  "No such file or directory",
  "failed to load manifest",
  "failed to load source for dependency",
  "failed to get `fnx-classes`",
  "failed to read",
];

export function classifyProbeFailure(transcript: string): FailureClass {
  if (
    /rust-lld/.test(transcript) &&
    (/SIGABRT/.test(transcript) || /libLLVM\.dylib/.test(transcript) || /signal: 6/.test(transcript))
  ) {
    return "toolchain-lld";
  }
  const mentionsSibling = [...REQUIRED_SIBLINGS, "frankentorch"].some((name) => transcript.includes(name));
  const looksMissing =
    transcript.includes("No such file or directory") ||
    transcript.includes("does not exist") ||
    transcript.includes("failed to load manifest") ||
    transcript.includes("failed to load source for dependency") ||
    transcript.includes("missing-path-dependency") ||
    /failed to get `[a-z0-9-]+` as a dependency/i.test(transcript);
  if (mentionsSibling && looksMissing) return "absent-sibling";
  for (const marker of ABSENT_SIBLING_MARKERS) {
    if (transcript.includes(marker) && mentionsSibling) return "absent-sibling";
  }
  return "other";
}

function listCargoTomls(root: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (dir === undefined) break;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (name === ".git" || name === "target" || name === "artifacts" || name === "node_modules") continue;
      const full = join(dir, name);
      let stat;
      try {
        stat = statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) stack.push(full);
      else if (stat.isFile() && name === "Cargo.toml") out.push(full);
    }
  }
  return out.sort();
}
