/**
 * Does any module reachable from a client entry read a node: builtin (am-t84m)?
 *
 * The production build failed on Vercel for five days with four UnhandledSchemeError lines -
 * node:crypto, node:fs, node:path, node:url - while `bun run build` exited 0 locally and every
 * lane in this repository stayed green. No lane ran the build, so nothing here could see it.
 *
 * WHY THIS IS NOT JUST A WRAPPER AROUND `next build`. Wrapping the build would pass today and
 * catch nothing: the failure is not reproducible at HEAD, and the one source-level instance left
 * in the tree is invisible to webpack because its only importer is an unused barrel. The defect
 * is ONE IMPORT STATEMENT from returning - import the permalink barrel and node:zlib enters the
 * client graph, local stays green, and Vercel refuses it again. This asks the question the build
 * only answers by accident.
 *
 * VALUE EDGES ONLY, AND THAT IS THE WHOLE CORRECTNESS OF IT. `import type` and an all-type
 * specifier list are erased by the compiler and carry no runtime edge. Following them reported
 * 43 reachable modules through two choke edges - schemas/experiment.ts -> schemas/source.ts and
 * scheduler.ts -> schemas/experiment.ts - which are BOTH `import type`. Following value edges
 * only, that 43 is 0. A version of this gate that ignored the distinction would name
 * content/schemas as the culprit and send someone to rearrange a boundary that is already
 * correct.
 *
 * WHAT IT DOES NOT PROVE.
 *  - It does not run the build. A bundling failure with no node: import in it - a bad loader, an
 *    unresolvable alias - is outside this gate entirely, and no lane covers that yet.
 *  - It models the CLIENT graph only. node: in a server component is legitimate and is not
 *    reported. The edge runtime (src/proxy.ts) restricts builtins too and is not covered here.
 *  - It resolves relative specifiers only. A node: builtin reached through a package boundary is
 *    invisible to it.
 *  - A module can be in the client graph and still be tree-shaken out of every chunk, as the
 *    permalink subtree is today. This reports the source-level edge, which is the thing that
 *    breaks the next time someone imports it.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const CODE_FILE = /\.(?:tsx?|mjs|jsx?)$/;
const TEST_FILE = /\.test\./;

/** A node: builtin read by a module the client graph can reach, with the path that reaches it. */
export interface ClientGraphBuiltin {
  /** Repo-relative path of the module doing the importing. */
  readonly module: string;
  readonly builtins: readonly string[];
  /** Client entry first, importing module last. Each step is a VALUE import. */
  readonly chain: readonly string[];
}

export interface ClientGraphScan {
  readonly clientEntries: readonly string[];
  readonly sourceFilesScanned: number;
  readonly findings: readonly ClientGraphBuiltin[];
}

function walk(dir: string, out: string[] = []): string[] {
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (CODE_FILE.test(entry.name) && !TEST_FILE.test(entry.name)) out.push(full);
  }
  return out;
}

/** The "use client" directive, which must precede everything but comments and whitespace. */
export function isClientEntry(source: string): boolean {
  let rest = source;
  for (;;) {
    const trimmed = rest.replace(/^\s+/, "");
    if (trimmed.startsWith("//")) {
      rest = trimmed.slice(trimmed.indexOf("\n") + 1);
      continue;
    }
    if (trimmed.startsWith("/*")) {
      const end = trimmed.indexOf("*/");
      if (end === -1) return false;
      rest = trimmed.slice(end + 2);
      continue;
    }
    return /^["']use client["']/.test(trimmed);
  }
}

/**
 * Specifiers imported for their VALUES. An `import type` clause, and a brace list whose every
 * specifier is `type`-prefixed, are erased and are not returned.
 */
export function valueImports(source: string): string[] {
  const out: string[] = [];
  const statement =
    /(?:^|\n)\s*(?:import|export)(?<typeKeyword>\s+type)?\s+(?<clause>[^;]*?)from\s*["'](?<spec>[^"']+)["']/g;
  for (const match of source.matchAll(statement)) {
    const groups = match.groups;
    if (!groups?.spec) continue;
    if (groups.typeKeyword) continue;
    const clause = groups.clause ?? "";
    const braces = /\{([^}]*)\}/.exec(clause);
    if (braces?.[1] !== undefined) {
      const specifiers = braces[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const hasDefaultOrNamespace = clause.replace(/\{[^}]*\}/, "").replace(/[\s,]/g, "") !== "";
      if (
        !hasDefaultOrNamespace &&
        specifiers.length > 0 &&
        specifiers.every((s) => /^type\s/.test(s))
      ) {
        continue;
      }
    }
    out.push(groups.spec);
  }
  // A dynamic import creates a chunk, so it is a value edge.
  for (const match of source.matchAll(/import\s*\(\s*["']([^"']+)["']/g)) {
    if (match[1]) out.push(match[1]);
  }
  // A BARE side-effect import has no `from` clause and is the strongest value edge there is -
  // it exists only to be executed. The first version of this function required `from` and
  // therefore missed it, which the driven plant for am-t84m caught: importing the permalink
  // barrel as `import "./index.ts";` into a live client component left this gate GREEN.
  for (const match of source.matchAll(/(?:^|\n)\s*import\s+["']([^"']+)["']\s*;/g)) {
    if (match[1]) out.push(match[1]);
  }
  return out;
}

function resolveRelative(fromFile: string, spec: string): string | null {
  if (!spec.startsWith(".")) return null;
  const base = resolve(dirname(fromFile), spec);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.mjs`,
    `${base}.js`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const nodeBuiltinsIn = (source: string): string[] =>
  [
    ...new Set(
      [...source.matchAll(/from\s*["'](node:[a-z_/]+)["']/g)].map((match) => match[1] ?? ""),
    ),
  ].filter(Boolean);

export function scanClientGraphForNodeBuiltins(rootDir: string): ClientGraphScan {
  const srcDir = join(rootDir, "src");
  const files = walk(srcDir);
  const read = new Map<string, string>();
  const sourceOf = (file: string): string => {
    const cached = read.get(file);
    if (cached !== undefined) return cached;
    const text = readFileSync(file, "utf8");
    read.set(file, text);
    return text;
  };

  const clientEntries = files.filter((file) => isClientEntry(sourceOf(file)));
  const rel = (file: string): string => relative(rootDir, file);
  const findings: ClientGraphBuiltin[] = [];
  const reported = new Set<string>();

  for (const entry of clientEntries) {
    const seen = new Set<string>([entry]);
    const queue: { file: string; chain: string[] }[] = [{ file: entry, chain: [entry] }];
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) break;
      const builtins = nodeBuiltinsIn(sourceOf(next.file));
      // Deduplicated by (entry, module), which is the SAME key an exemption uses. Deduplicating
      // by module alone made the report order-dependent: with two entries reaching one module
      // only the first chain appeared, so whether a known chain was visible depended on
      // traversal order, and a staleness check on the exemption list could fail for that reason
      // rather than because the exemption was stale. The plant for am-t84m surfaced exactly
      // that.
      const key = `${rel(entry)} -> ${rel(next.file)}`;
      if (builtins.length > 0 && !reported.has(key)) {
        reported.add(key);
        findings.push({ module: rel(next.file), builtins, chain: next.chain.map(rel) });
      }
      for (const spec of valueImports(sourceOf(next.file))) {
        const target = resolveRelative(next.file, spec);
        if (target !== null && !seen.has(target)) {
          seen.add(target);
          queue.push({ file: target, chain: [...next.chain, target] });
        }
      }
    }
  }
  return { clientEntries: clientEntries.map(rel), sourceFilesScanned: files.length, findings };
}
