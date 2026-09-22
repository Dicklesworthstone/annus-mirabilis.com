import { lstat, readdir, readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface DenylistEntry {
  pattern: string;
  category: string;
  reason: string;
}

export interface DenylistConfig {
  version: number;
  description: string;
  denylist: DenylistEntry[];
  allowedRenderers?: { pattern: string; reason: string }[];
}

export interface GuardViolation {
  file: string;
  line: number;
  pattern: string;
  reason: string;
  snippet: string;
}

export interface GuardScanResult {
  ok: boolean;
  violations: GuardViolation[];
  scannedFileCount: number;
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export async function loadDenylist(root = ROOT): Promise<DenylistConfig> {
  const denylistPath = resolve(root, "scripts/ocr-guard-denylist.json");
  const content = await readFile(denylistPath, "utf-8");
  return JSON.parse(content) as DenylistConfig;
}

interface CompiledMatcher {
  entry: DenylistEntry;
  patternLower: string;
  importRegex?: RegExp | undefined;
  spawnRegex?: RegExp | undefined;
  binaryRegex?: RegExp | undefined;
  symbolRegex?: RegExp | undefined;
}

/**
 * The process launchers a call may use, as a regex alternation (am-jb4c).
 *
 * This was `(?:spawn|exec|execSync|execFile|fork)`, which omitted every *Sync*
 * variant except execSync. `spawn` does match the first five letters of
 * `spawnSync`, and the `\\s*\\(` that follows then fails against `Sync(`, so the
 * whole match failed and three of the six call forms in this repository were
 * invisible to the guard: spawnSync, execFileSync, and Bun.spawnSync's array
 * form. That is the worst possible set to miss here, because this is a Bun
 * repository and those are the forms an author would reach for - the repo's own
 * code spawns binaries as spawnSync("tool", [...]).
 *
 * It stays a CALL matcher and must not become a prose matcher. Every use below
 * requires this alternation to be followed by an opening parenthesis and the
 * denied name as a quoted argument, so `const engine = "tesseract"` and the
 * words in this comment are not violations. AGENTS.md's OCR rule has no
 * exceptions; a guard switched off for crying wolf enforces nothing at all.
 */
const PROCESS_LAUNCHERS = "\\b(?:spawnSync|spawn|execFileSync|execFile|execSync|exec|fork)";

function compileMatchers(denylist: DenylistEntry[]): CompiledMatcher[] {
  return denylist.map((entry) => {
    const p = entry.pattern;
    const matcher: CompiledMatcher = {
      entry,
      patternLower: p.toLowerCase(),
    };

    if (entry.category === "dependency-or-import" || entry.category === "import-or-spawn") {
      matcher.importRegex = new RegExp(
        `(?:import\\s+(?:(?:[\\w*\\s{},$]+)\\s+from\\s+)?['"\`][^'"\`]*${escapeRegex(p)}[^'"\`]*['"\`]|require\\s*\\(\\s*['"\`][^'"\`]*${escapeRegex(p)}[^'"\`]*['"\`])`,
        "i",
      );
    }

    if (entry.category === "binary-or-spawn" || entry.category === "import-or-spawn") {
      // `\\s*\\(?` before the quote admits the array form, Bun.spawnSync(["tool", ...]).
      matcher.spawnRegex = new RegExp(
        `${PROCESS_LAUNCHERS}\\s*\\(\\s*\\[?\\s*['"\`]${escapeRegex(p)}['"\`]`,
        "i",
      );
      matcher.binaryRegex = new RegExp(
        `${PROCESS_LAUNCHERS}\\s*\\([^)]*['"\`]\\s*${escapeRegex(p)}\\b`,
        "i",
      );
    }

    if (entry.category === "code-symbol") {
      matcher.symbolRegex = new RegExp(`\\b${escapeRegex(p)}\\b`);
    }

    return matcher;
  });
}

const matcherCache = new WeakMap<DenylistEntry[], CompiledMatcher[]>();

function getCompiledMatchers(denylist: DenylistEntry[]): CompiledMatcher[] {
  let matchers = matcherCache.get(denylist);
  if (!matchers) {
    matchers = compileMatchers(denylist);
    matcherCache.set(denylist, matchers);
  }
  return matchers;
}

export function scanContentForViolations(
  filePath: string,
  content: string,
  denylist: DenylistEntry[],
): GuardViolation[] {
  const violations: GuardViolation[] = [];
  const lines = content.split("\n");

  // Check if file is a package.json
  if (filePath.endsWith("package.json")) {
    try {
      const parsed = JSON.parse(content);
      const allDeps = {
        ...(parsed.dependencies || {}),
        ...(parsed.devDependencies || {}),
        ...(parsed.peerDependencies || {}),
        ...(parsed.optionalDependencies || {}),
      };
      for (const entry of denylist) {
        if (entry.pattern in allDeps) {
          violations.push({
            file: filePath,
            line: 1,
            pattern: entry.pattern,
            reason: entry.reason,
            snippet: `dependency "${entry.pattern}": "${allDeps[entry.pattern]}"`,
          });
        }
      }
    } catch {
      // If invalid JSON, will fall through to line scan
    }
  }

  const matchers = getCompiledMatchers(denylist);

  // Scan line by line for imports, spawns, or code symbols
  let inExemptCommentBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const trimmed = line.trim();

    // Skip comments that merely mention the denylist or explain guard rules.
    //
    // THE EXEMPTION IS BLOCK-AWARE, and that is a fix rather than a widening. It used to test
    // each line on its own, so a comment that WRAPS lost the exemption on every line after the
    // first: download-facsimiles.ts carries a block explaining the owner's ruling, and its
    // continuation line "and pdftotext and pdf.js getTextContent both carry the same ..." held
    // neither "denylist" nor "forbidden" nor "policy" because those words were two lines up.
    // A true explanation of the rule failed the rule.
    //
    // The conservative half is kept deliberately: a "//" line that opens no exempt block still
    // flags, so commented-out CODE - `// spawnSync("pdftotext", ...)` sitting in an unrelated
    // comment - is still reported. Only a contiguous run of "//" lines begun by a line that
    // names the policy inherits the exemption, and any non-comment line ends the run.
    if (trimmed.startsWith("//")) {
      if (
        trimmed.includes("denylist") ||
        trimmed.includes("forbidden") ||
        trimmed.includes("policy")
      ) {
        inExemptCommentBlock = true;
      }
      if (inExemptCommentBlock) {
        continue;
      }
    } else {
      inExemptCommentBlock = false;
    }

    const lineLower = line.toLowerCase();

    for (const m of matchers) {
      const p = m.entry.pattern;

      // Fast path: if pattern isn't even in line, skip all regexes
      if (!lineLower.includes(m.patternLower)) {
        continue;
      }

      let matched = false;

      if (m.importRegex?.test(line)) {
        matched = true;
      }

      if (!matched && m.spawnRegex?.test(line)) {
        matched = true;
      }

      if (!matched && m.binaryRegex?.test(line)) {
        matched = true;
      }

      if (!matched && m.symbolRegex?.test(line)) {
        matched = true;
      }

      if (matched) {
        violations.push({
          file: filePath,
          line: i + 1,
          pattern: p,
          reason: m.entry.reason,
          snippet: line.trim(),
        });
      }
    }
  }

  return violations;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function scanRepositoryForForbiddenOcr(
  root = ROOT,
  customFiles?: { path: string; content: string }[],
): Promise<GuardScanResult> {
  const denylistConfig = await loadDenylist(root);
  const denylist = denylistConfig.denylist;
  const violations: GuardViolation[] = [];
  let scannedCount = 0;

  if (customFiles) {
    for (const file of customFiles) {
      scannedCount++;
      const fileViolations = scanContentForViolations(file.path, file.content, denylist);
      violations.push(...fileViolations);
    }
    return {
      ok: violations.length === 0,
      violations,
      scannedFileCount: scannedCount,
    };
  }

  const scanDirs = ["scripts", "src"];
  const scanFiles = ["package.json"];

  for (const file of scanFiles) {
    const fullPath = resolve(root, file);
    try {
      const content = await readFile(fullPath, "utf-8");
      scannedCount++;
      violations.push(...scanContentForViolations(file, content, denylist));
    } catch {
      // file might not exist
    }
  }

  async function walk(dirPath: string): Promise<void> {
    const entries = await readdir(dirPath);
    for (const name of entries) {
      const full = resolve(dirPath, name);
      const rel = relative(root, full).split("\\").join("/");

      // Skip test fixtures in ocr-guard, the denylist json, guard tests, and scanner itself
      if (rel.includes("src/testing/fixtures/ocr-guard")) continue;
      if (rel === "scripts/ocr-guard-denylist.json") continue;
      if (rel === "scripts/sources/ocrGuard.ts") continue;
      if (rel === "scripts/ocr-guard.test.ts") continue;
      if (rel.includes("node_modules")) continue;
      if (rel.includes(".next")) continue;
      if (rel.includes(".git")) continue;
      if (rel.includes("artifacts")) continue;

      const stat = await lstat(full);
      if (stat.isDirectory()) {
        await walk(full);
      } else if (stat.isFile()) {
        if (/\.(ts|tsx|js|mjs|cjs|json)$/.test(name)) {
          scannedCount++;
          const content = await readFile(full, "utf-8");
          violations.push(...scanContentForViolations(rel, content, denylist));
        }
      }
    }
  }

  for (const dir of scanDirs) {
    const fullDir = resolve(root, dir);
    try {
      await walk(fullDir);
    } catch {
      // dir may not exist yet
    }
  }

  return {
    ok: violations.length === 0,
    violations,
    scannedFileCount: scannedCount,
  };
}
