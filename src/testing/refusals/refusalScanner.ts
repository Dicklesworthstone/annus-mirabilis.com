/**
 * Refusal throw site scanner and test coverage analyzer (am-muyh).
 *
 * Governed by bead am-muyh and doctrine 8 (typed refusal states).
 *
 * Scans source files under src/ for refusal throw sites:
 * - throw new <ErrorClass>({ kind/code/rule: "..." })
 * - throw new <ErrorClass>("kebab-code", ...)
 * - Diagnostics/returns emitting rule: "...", refusalCode: "...", errorCode: "..."
 * - code: "..." in refusal/error/diagnostic accumulators (ok: false, errors.push, etc.)
 *
 * Compares against test files to count how many distinct test blocks or explicit site citations
 * exercise each refusal code.
 *
 * Unit of measure is the THROW SITE, not the code string:
 * - A single test naming a code covers AT MOST 1 throw site of that code in that file.
 * - Multiple throw sites with the same refusal code require multiple tests or explicit site citations.
 * - Cross-file code laundering is prevented by scoping test coverage to imported/targeted source files.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, normalize, relative } from "node:path";

export interface RefusalThrowSite {
  readonly file: string;
  readonly line: number;
  readonly code: string;
  readonly snippet: string;
}

export interface RefusalCodeBreakdown {
  readonly code: string;
  readonly totalSites: number;
  readonly testedSites: number;
  readonly untestedSites: number;
  readonly lines: readonly number[];
}

export interface FileRefusalAnalysis {
  readonly file: string;
  readonly totalSites: number;
  readonly untestedSitesCount: number;
  readonly untestedBreakdown: readonly RefusalCodeBreakdown[];
}

export interface FullRefusalScanResult {
  readonly analyses: Map<string, FileRefusalAnalysis>;
  readonly totalUntested: number;
  readonly totalSites: number;
}

const KEBAB_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)+$/;
const SPECIAL_CODES = new Set(["cycle", "dangling", "invalid"]);

/**
 * Validates whether a candidate string is a structured refusal code.
 */
export function isRefusalCode(candidate: string): boolean {
  return KEBAB_REGEX.test(candidate) || SPECIAL_CODES.has(candidate);
}

/**
 * Recursively locates non-test TypeScript source files under dir.
 */
export function findSourceFiles(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;

  function walk(d: string): void {
    for (const entry of readdirSync(d)) {
      if (entry === "node_modules" || entry === ".next" || entry === ".git" || entry === "testing")
        continue;
      const full = join(d, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (
        (entry.endsWith(".ts") || entry.endsWith(".tsx")) &&
        !entry.includes(".test.") &&
        !entry.includes(".cases.") &&
        !entry.includes(".fixture.") &&
        !full.includes("/testing/")
      ) {
        out.push(full);
      }
    }
  }
  walk(dir);
  return out;
}

/**
 * Recursively locates test files under specified directories.
 */
export function findTestFiles(dirs: readonly string[]): string[] {
  const out: string[] = [];
  function walk(d: string): void {
    if (!existsSync(d)) return;
    for (const entry of readdirSync(d)) {
      if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
      const full = join(d, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (
        entry.includes(".test.") ||
        entry.includes(".cases.") ||
        entry.endsWith(".test.ts") ||
        entry.endsWith(".test.tsx") ||
        entry.endsWith(".test.mjs") ||
        entry.endsWith(".test.js")
      ) {
        out.push(full);
      }
    }
  }
  for (const d of dirs) walk(d);
  return out;
}

/**
 * Scans source file text for refusal throw sites.
 */
export function scanRefusalThrowSites(source: string, relPath: string): RefusalThrowSite[] {
  const sites: RefusalThrowSite[] = [];
  const lines = source.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const lineNum = i + 1;

    // Pattern 1: throw new <ErrorClass>(...) with options object or code string
    if (line.includes("throw new ")) {
      const window = lines.slice(i, Math.min(lines.length, i + 8)).join("\n");
      const propMatch = window.match(
        /(?:kind|code|rule|refusalCode|errorCode)\s*:\s*["']([a-zA-Z0-9_-]+)["']/,
      );
      const strArgMatch = window.match(
        /throw\s+new\s+[A-Za-z0-9_]*Error\s*\(\s*["']([a-zA-Z0-9_-]+)["']/,
      );

      const propCode = propMatch?.[1];
      if (propCode && isRefusalCode(propCode)) {
        sites.push({
          file: relPath,
          line: lineNum,
          code: propCode,
          snippet: line.trim(),
        });
        continue;
      }
      const strCode = strArgMatch?.[1];
      if (strCode && isRefusalCode(strCode)) {
        sites.push({
          file: relPath,
          line: lineNum,
          code: strCode,
          snippet: line.trim(),
        });
        continue;
      }
    }

    // Pattern 2: Explicit refusal / rule properties in diagnostics or returns
    const refPropMatch = line.match(
      /(?:rule|refusalCode|errorCode)\s*:\s*["']([a-zA-Z0-9_-]+)["']/,
    );
    const refCode = refPropMatch?.[1];
    if (refCode && isRefusalCode(refCode)) {
      sites.push({
        file: relPath,
        line: lineNum,
        code: refCode,
        snippet: line.trim(),
      });
      continue;
    }

    // Pattern 3: code: "..." in refusal, error, or diagnostic contexts
    const codeMatch = line.match(/code\s*:\s*["']([a-zA-Z0-9_-]+)["']/);
    const candidateCode = codeMatch?.[1];
    if (candidateCode && isRefusalCode(candidateCode)) {
      const contextWindow = lines
        .slice(Math.max(0, i - 4), Math.min(lines.length, i + 5))
        .join("\n");
      if (
        contextWindow.includes("ok: false") ||
        contextWindow.includes("errors.push") ||
        contextWindow.includes("diagnostics.push") ||
        contextWindow.includes("issues.push") ||
        contextWindow.includes("findings.push") ||
        contextWindow.includes("violations.push") ||
        contextWindow.includes("refusals.push") ||
        contextWindow.includes('status: "refused"') ||
        contextWindow.includes("Finding") ||
        contextWindow.includes("KernelIssue") ||
        contextWindow.includes("severity:")
      ) {
        sites.push({
          file: relPath,
          line: lineNum,
          code: candidateCode,
          snippet: line.trim(),
        });
      }
    }
  }

  return sites;
}

/**
 * Runs full repository analysis comparing detected refusal throw sites against test suites.
 */
export function analyzeUntestedRefusals(rootDir: string): FullRefusalScanResult {
  const srcFiles = findSourceFiles(join(rootDir, "src"));
  const testFiles = findTestFiles([join(rootDir, "src"), join(rootDir, "scripts")]);

  // 1. Scan all refusal throw sites per file
  const sitesByFile = new Map<string, RefusalThrowSite[]>();
  let totalSites = 0;
  for (const sf of srcFiles) {
    const rel = relative(rootDir, sf);
    const content = readFileSync(sf, "utf8");
    const sites = scanRefusalThrowSites(content, rel);
    if (sites.length > 0) {
      sitesByFile.set(rel, sites);
      totalSites += sites.length;
    }
  }

  // 2. Index tests per file
  // Map: fileRel -> Map<code, count of test blocks asserting code>
  const testBlocksByFileAndCode = new Map<string, Map<string, number>>();
  // Map: fileRel -> Set<line of explicitly cited throw site e.g. (file.ts:90)>
  const explicitSiteCitations = new Map<string, Set<number>>();

  for (const tf of testFiles) {
    const content = readFileSync(tf, "utf8");
    const tfDir = dirname(tf);
    const importedFiles = new Set<string>();

    // Co-located source candidates (e.g. foo.test.ts -> foo.ts)
    const baseCo = tf.replace(/\.test\.(ts|tsx|mjs|js)$/, "");
    for (const ext of [".ts", ".tsx"]) {
      const candidate = relative(rootDir, baseCo + ext);
      if (sitesByFile.has(candidate)) importedFiles.add(candidate);
    }

    // Static imports
    const importMatches = content.matchAll(/from\s+["']([^"']+)["']/g);
    for (const im of importMatches) {
      const importPath = im[1];
      if (importPath?.startsWith(".")) {
        const resolved = normalize(join(tfDir, importPath));
        for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
          const candidate = relative(rootDir, resolved + ext);
          if (sitesByFile.has(candidate)) {
            importedFiles.add(candidate);
          }
        }
      }
    }

    // Basename mention in test file (e.g. tests referencing authored.ts)
    for (const srcRel of sitesByFile.keys()) {
      const b = basename(srcRel);
      if (content.includes(b)) {
        importedFiles.add(srcRel);
      }
    }

    // Check for explicit site citations like (authored.ts:90), (verifyChain.ts:88), or (passageActions.schema.ts:60)
    const siteCiteMatches = content.matchAll(/\(([a-zA-Z0-9_.-]+\.ts):(\d+)\)/g);
    for (const scm of siteCiteMatches) {
      const citedBase = scm[1];
      const citedLineStr = scm[2];
      if (citedBase && citedLineStr) {
        const citedLine = Number.parseInt(citedLineStr, 10);
        for (const srcRel of sitesByFile.keys()) {
          if (basename(srcRel) === citedBase) {
            let citedSet = explicitSiteCitations.get(srcRel);
            if (!citedSet) {
              citedSet = new Set<number>();
              explicitSiteCitations.set(srcRel, citedSet);
            }
            citedSet.add(citedLine);
          }
        }
      }
    }

    // Count test blocks asserting codes
    const blocks = content.split(/(?:test|it)\s*\(/);
    for (const srcRel of importedFiles) {
      let codeMap = testBlocksByFileAndCode.get(srcRel);
      if (!codeMap) {
        codeMap = new Map<string, number>();
        testBlocksByFileAndCode.set(srcRel, codeMap);
      }
      const sites = sitesByFile.get(srcRel) ?? [];
      const codes = new Set(sites.map((s) => s.code));

      for (const code of codes) {
        let blockCount = 0;
        for (let b = 1; b < blocks.length; b++) {
          const block = blocks[b] ?? "";
          if (block.includes(`"${code}"`) || block.includes(`'${code}'`) || block.includes(code)) {
            blockCount++;
          }
        }
        if (blockCount > 0) {
          codeMap.set(code, (codeMap.get(code) ?? 0) + blockCount);
        }
      }
    }
  }

  // 3. Compute analysis per file
  const analyses = new Map<string, FileRefusalAnalysis>();
  let totalUntested = 0;

  for (const [file, sites] of sitesByFile) {
    const codeMap = testBlocksByFileAndCode.get(file) ?? new Map<string, number>();
    const citedLines = explicitSiteCitations.get(file) ?? new Set<number>();

    // Group sites by code
    const sitesByCode = new Map<string, RefusalThrowSite[]>();
    for (const s of sites) {
      let list = sitesByCode.get(s.code);
      if (!list) {
        list = [];
        sitesByCode.set(s.code, list);
      }
      list.push(s);
    }

    const breakdown: RefusalCodeBreakdown[] = [];
    let fileUntested = 0;

    for (const [code, codeSites] of sitesByCode) {
      const totalCodeSites = codeSites.length;
      let testedSites = 0;
      const unassertedLines: number[] = [];

      // Count explicit line citations first
      const unCitedSites: RefusalThrowSite[] = [];
      for (const s of codeSites) {
        if (citedLines.has(s.line)) {
          testedSites++;
        } else {
          unCitedSites.push(s);
        }
      }

      // Remaining sites are covered by general test blocks for this code
      const remainingTests = Math.max(0, (codeMap.get(code) ?? 0) - testedSites);
      const additionalTested = Math.min(unCitedSites.length, remainingTests);
      testedSites += additionalTested;

      const untestedCount = Math.max(0, totalCodeSites - testedSites);
      fileUntested += untestedCount;

      for (let idx = additionalTested; idx < unCitedSites.length; idx++) {
        const item = unCitedSites[idx];
        if (item) {
          unassertedLines.push(item.line);
        }
      }

      if (untestedCount > 0) {
        breakdown.push({
          code,
          totalSites: totalCodeSites,
          testedSites,
          untestedSites: untestedCount,
          lines: unassertedLines,
        });
      }
    }

    analyses.set(file, {
      file,
      totalSites: sites.length,
      untestedSitesCount: fileUntested,
      untestedBreakdown: breakdown,
    });
    totalUntested += fileUntested;
  }

  return { analyses, totalUntested, totalSites };
}

/* ------------------------------------------------------------------------- *
 * Bare throw sites (am-muyh)
 *
 * `scanRefusalThrowSites` records a site only when it can read a kebab-case
 * refusal code off it. A `throw new TypeError("Concurrent requests to a single
 * walk owner.")` carries prose and no code, so it produces no site at all: it
 * is not counted as tested, not counted as untested, and does not appear in
 * any report. Measured on 2026-09-19 the repository held 1832 coded sites and
 * 1018 bare ones across 294 files, so 36% of the refusal population was
 * invisible to the instrument that governs it.
 *
 * A bare throw is not automatically a defect. Invariant guards and re-throws
 * are legitimate, and this scanner makes no claim about which is which. It
 * claims only that these sites are UNMEASURED by the code-based scanner, and
 * gives them a name so the class can be reported rather than omitted.
 * ------------------------------------------------------------------------- */

export interface BareThrowSite {
  readonly file: string;
  readonly line: number;
  readonly snippet: string;
}

/** `throw new X(` on one line. A bare `throw err;` re-throw is not a site. */
const THROW_NEW = /\bthrow\s+new\s+[A-Za-z_$][\w$]*\s*\(/;

/**
 * Throw sites in one file that `scanRefusalThrowSites` does not record,
 * because no refusal code can be read off them.
 */
export function scanBareThrowSites(source: string, relPath: string): BareThrowSite[] {
  const coded = new Set(scanRefusalThrowSites(source, relPath).map((s) => s.line));
  const out: BareThrowSite[] = [];
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!THROW_NEW.test(line)) continue;
    if (coded.has(i + 1)) continue;
    out.push({ file: relPath, line: i + 1, snippet: line.trim() });
  }
  return out;
}

export interface BareThrowScanResult {
  /** Files holding at least one bare throw, in path order. */
  readonly byFile: ReadonlyMap<string, readonly BareThrowSite[]>;
  readonly totalBare: number;
  readonly totalCoded: number;
  readonly filesScanned: number;
}

/**
 * Repository-wide bare throw census. Reported every run, including when it is
 * zero: a class that vanishes from a report is worse than one reported as
 * zero, because its absence reads as absence of the problem.
 */
export function scanBareThrows(rootDir: string): BareThrowScanResult {
  const srcFiles = findSourceFiles(join(rootDir, "src"));
  const byFile = new Map<string, readonly BareThrowSite[]>();
  let totalBare = 0;
  let totalCoded = 0;
  for (const sf of srcFiles.slice().sort()) {
    const rel = relative(rootDir, sf);
    const content = readFileSync(sf, "utf8");
    totalCoded += new Set(scanRefusalThrowSites(content, rel).map((s) => s.line)).size;
    const bare = scanBareThrowSites(content, rel);
    if (bare.length > 0) {
      byFile.set(rel, bare);
      totalBare += bare.length;
    }
  }
  return { byFile, totalBare, totalCoded, filesScanned: srcFiles.length };
}
