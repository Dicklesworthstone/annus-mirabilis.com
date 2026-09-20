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
import * as ts from "typescript";

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

export interface RootScanTally {
  readonly files: number;
  readonly sites: number;
  readonly untested: number;
}

export interface FullRefusalScanResult {
  readonly analyses: Map<string, FileRefusalAnalysis>;
  readonly totalUntested: number;
  readonly totalSites: number;
  /**
   * One entry per declared scan root, present even when the root contributes
   * nothing. A root that appears only when it has sites is a root whose silence
   * cannot be told from its absence, which is the defect am-kfkw names.
   */
  readonly byRoot: Map<string, RootScanTally>;
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
 * Roots the coded scan reads.
 *
 * `src` alone was the original scope, which left every refusal under `scripts/`
 * absent from the analysis rather than measured as zero. An absent class is the
 * defect am-kfkw exists to name, so the roots are a declared constant and the
 * ratchet reports each one even when it contributes nothing.
 */
export const CODED_SCAN_ROOTS = ["src", "scripts"] as const;

export interface SourceFileScanOptions {
  /**
   * Whether to descend into `testing` directories.
   *
   * The original walk skipped them, on the reasoning that test infrastructure is
   * not product code. But a refusal thrown by a harness is still a refusal that
   * no test exercises, and skipping the directory made that population invisible
   * rather than small. Files whose NAME marks them as tests or fixtures stay
   * excluded either way: those are the tests, not the things under test.
   */
  readonly includeTestingDirs?: boolean;
}

/**
 * Recursively locates non-test TypeScript source files under dir.
 */
export function findSourceFiles(dir: string, options: SourceFileScanOptions = {}): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  const includeTesting = options.includeTestingDirs === true;

  function walk(d: string): void {
    for (const entry of readdirSync(d)) {
      if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
      if (!includeTesting && entry === "testing") continue;
      const full = join(d, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (
        (entry.endsWith(".ts") || entry.endsWith(".tsx")) &&
        !entry.includes(".test.") &&
        !entry.includes(".cases.") &&
        !entry.includes(".fixture.") &&
        (includeTesting || !full.includes("/testing/"))
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

const PASS_OUTCOME_HINT = /\boutcome\s*:\s*["'](pass|passed)["']/;

/**
 * Lines belonging to a record that reports its own outcome as a literal pass.
 *
 * The property patterns below read `rule:`, `code:` and friends wherever they
 * appear, which means a structured log line reporting SUCCESS was counted as a
 * refusal site and the ratchet then demanded a test for it. `all-pass` in
 * check-receipts.ts is the clearest case: `severity: "info"`, `outcome: "pass"`,
 * message "Receipt passed all verification checks."
 *
 * The discriminator is the record's own outcome, not its name and not the fact
 * that it is a log line. Failure records keep their sites: `no-parallel-deny-lists`
 * in lint-voice.ts is emitted the same way, with `outcome: "failed"`, and IS the
 * only emission of that violation. A record whose outcome is computed
 * (`errors.length === 0 ? "passed" : "failed"`) also keeps its site, because it
 * can report a failure.
 *
 * Only the property forms consult this. A `throw` is a refusal whatever record
 * surrounds it, so `outcome: "passed"` beside one cannot hide it.
 */
function passOutcomeRecordLines(source: string): Set<number> {
  const lines = new Set<number>();
  // Nothing to parse in the overwhelming majority of files.
  if (!PASS_OUTCOME_HINT.test(source)) return lines;
  const file = ts.createSourceFile("record.ts", source, ts.ScriptTarget.Latest, true);
  const visit = (node: ts.Node): void => {
    if (ts.isObjectLiteralExpression(node)) {
      const reportsPass = node.properties.some(
        (prop) =>
          ts.isPropertyAssignment(prop) &&
          prop.name.getText(file) === "outcome" &&
          ts.isStringLiteralLike(prop.initializer) &&
          (prop.initializer.text === "pass" || prop.initializer.text === "passed"),
      );
      if (reportsPass) {
        for (const prop of node.properties) {
          lines.add(file.getLineAndCharacterOfPosition(prop.getStart(file)).line + 1);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return lines;
}

/**
 * Scans source file text for refusal throw sites.
 */
export function scanRefusalThrowSites(source: string, relPath: string): RefusalThrowSite[] {
  const sites: RefusalThrowSite[] = [];
  const lines = source.split("\n");
  const passOutcomeLines = passOutcomeRecordLines(source);

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
    if (refCode && isRefusalCode(refCode) && !passOutcomeLines.has(lineNum)) {
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
    if (candidateCode && isRefusalCode(candidateCode) && !passOutcomeLines.has(lineNum)) {
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
/**
 * Does this test block assert this refusal code?
 *
 * The code must appear AS A STRING LITERAL. A third disjunct, `block.includes(code)`,
 * stood beside these two and made both redundant: it credited coverage to any block
 * that merely CONTAINED the code, so a block testing `"tape-artifact-mismatch"` counted
 * as covering `artifact-mismatch`, which nothing may have tested.
 *
 * Measured over this scanner's own population, from its own roots and its own
 * scanRefusalThrowSites: 1320 distinct codes, of which 84 are a prefix of another and
 * 40 are a substring of another away from the start. The count feeds a per-site budget
 * below, so every fragment match inflated the number of sites reported as covered. The
 * direction is fail-open on a coverage measurement.
 *
 * Backticks are deliberately not accepted: checked across all 1156 test files, no code
 * appears only in a template-literal form, so admitting one would widen the rule
 * without covering anything (am-he9s).
 */
export function blockCoversCode(block: string, code: string): boolean {
  return block.includes(`"${code}"`) || block.includes(`'${code}'`);
}

export function analyzeUntestedRefusals(rootDir: string): FullRefusalScanResult {
  const testFiles = findTestFiles([join(rootDir, "src"), join(rootDir, "scripts")]);

  // 1. Scan all refusal throw sites per file, tallying each declared root
  // separately so none of them can go quiet.
  const sitesByFile = new Map<string, RefusalThrowSite[]>();
  const rootTallies = new Map<string, { files: number; sites: number; untested: number }>();
  const rootOf = new Map<string, string>();
  let totalSites = 0;
  for (const root of CODED_SCAN_ROOTS) {
    const tally = { files: 0, sites: 0, untested: 0 };
    rootTallies.set(root, tally);
    for (const sf of findSourceFiles(join(rootDir, root), { includeTestingDirs: true })) {
      const rel = relative(rootDir, sf);
      const content = readFileSync(sf, "utf8");
      const sites = scanRefusalThrowSites(content, rel);
      tally.files += 1;
      if (sites.length > 0) {
        sitesByFile.set(rel, sites);
        rootOf.set(rel, root);
        tally.sites += sites.length;
        totalSites += sites.length;
      }
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

    // Static and dynamic imports, resolved as modules.
    //
    // What stood here as well, until am-fkyc, was a raw substring test:
    // `content.includes(basename(srcRel))` over the whole test file, comments
    // included. It credited a source file with coverage because its file NAME
    // appeared anywhere in a test file, and basenames are not unique - 74 are
    // shared across this tree, `session.ts` by 37 files. One mention credited
    // all 37. I tripped it myself, in a comment, and the slack pawl is the only
    // thing that caught it. A test covers what it loads.
    for (const match of [
      ...content.matchAll(/\bfrom\s+["']([^"']+)["']/g),
      ...content.matchAll(/\bimport\s*\(\s*["']([^"']+)["']/g),
      ...content.matchAll(/\brequire\s*\(\s*["']([^"']+)["']/g),
    ]) {
      const importPath = match[1];
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

    // Check for explicit site citations like (authored.ts:90), (verifyChain.ts:88), or (passageActions.schema.ts:60)
    const siteCiteMatches = content.matchAll(/\(([a-zA-Z0-9_.-]+\.ts):(\d+)\)/g);
    for (const scm of siteCiteMatches) {
      const citedBase = scm[1];
      const citedLineStr = scm[2];
      if (citedBase && citedLineStr) {
        const citedLine = Number.parseInt(citedLineStr, 10);
        // Scoped to the files this test actually imports. The citation says
        // WHICH SITE in a file the test drives; it is not itself a claim to
        // have driven a file, and matching it by basename alone across the
        // tree is the same laundering am-fkyc names - `(session.ts:42)` in a
        // comment would otherwise credit line 42 of all 37 session.ts files.
        for (const srcRel of importedFiles) {
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
          if (blockCoversCode(block, code)) {
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
    const tally = rootTallies.get(rootOf.get(file) ?? "");
    if (tally) tally.untested += fileUntested;
  }

  return { analyses, totalUntested, totalSites, byRoot: rootTallies };
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

/** The built-in error constructors, which say nothing about who was at fault. */
export const BUILTIN_ERROR_CLASSES: ReadonlySet<string> = new Set([
  "Error",
  "TypeError",
  "RangeError",
  "SyntaxError",
  "ReferenceError",
  "EvalError",
  "URIError",
  "AggregateError",
]);

export interface BareThrowSite {
  readonly file: string;
  readonly line: number;
  readonly snippet: string;
  /** The constructor named at the throw, e.g. "TypeError" or "KitchenInputError". */
  readonly errorClass: string;
  /**
   * True when the class is defined by this project rather than the language.
   *
   * This is the ONLY signal the scanner has about the refusal path, and it is
   * weak in a useful direction. Nobody defines KitchenInputError for an
   * internal invariant, so a project-defined class is good evidence that a
   * reader or an authored record was being refused. The converse does not
   * hold: plenty of built-in throws are refusals too. The count is therefore
   * a MEASURED LOWER BOUND on the refusal path and never a total.
   *
   * Doctrine 8 binds a throw where a reader should have received a typed
   * refusal; it does not bind a parser's internal invariant. This scanner
   * cannot separate those -- no caller analysis, no notion of reader-supplied
   * input. See am-kfkw.
   */
  readonly projectDefinedClass: boolean;
  /**
   * True when the nearest enclosing function declares a parameter of the
   * TypeScript `unknown` type.
   *
   * The second signal, and the only other principled one available without
   * tagging the source. `unknown` is the type system stating that it cannot
   * vouch for the value, which is the validation boundary itself. Sampling 12
   * of the sites this matches, ten read as unambiguous refusal path
   * (parseOfflineManifest, validateInline, a pasted-CSV size check,
   * parseNotebookDocument, parseCountermodelCase, validateAliases); the two
   * that did not are worker-host concurrency guards whose caller is our own
   * scheduler.
   *
   * A heuristic on function NAMES would match roughly 300 more sites and is
   * deliberately not implemented: it would classify on spelling and dilute
   * the only figures here that are defensible.
   */
  readonly enclosingTakesUnknown: boolean;
}

/**
 * Does this parameter's declared type say `unknown` at the top level?
 *
 * Deliberately strict. `Record<string, unknown>` and `unknown[]` say the
 * VALUES are unvouched while the shape is known, which is weaker evidence,
 * and counting them would loosen a figure whose whole purpose is to be a
 * bound nobody has to argue about. A type alias that resolves to `unknown`
 * is missed: that would need the type checker rather than the parser, and is
 * a known residual rather than an oversight.
 */
function declaresUnknown(type: ts.TypeNode | undefined): boolean {
  if (!type) return false;
  if (type.kind === ts.SyntaxKind.UnknownKeyword) return true;
  if (ts.isUnionTypeNode(type) || ts.isIntersectionTypeNode(type)) {
    return type.types.some((member) => member.kind === ts.SyntaxKind.UnknownKeyword);
  }
  if (ts.isParenthesizedTypeNode(type)) return declaresUnknown(type.type);
  return false;
}

/**
 * Lines holding a `throw` that sits inside a function taking an
 * `unknown`-typed parameter, found by parsing rather than by matching text.
 *
 * The first version of this walked backwards over source lines with a regex
 * for a signature. Compared against the parser over the whole tree it had no
 * false positives and missed 59 of 193 sites, 31%: multi-line signatures,
 * methods, nested and arrow functions, and destructured parameters. A regex
 * cannot see lexical scope, which is the thing being asked about.
 */
function unknownParamThrowLines(source: string, relPath: string): ReadonlySet<number> {
  const lines = new Set<number>();
  let file: ts.SourceFile;
  try {
    file = ts.createSourceFile(
      relPath,
      source,
      ts.ScriptTarget.Latest,
      true,
      relPath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
  } catch {
    // UNREACHABLE in practice, and recorded as such rather than left looking
    // tested. ts.createSourceFile is error-tolerant: it reports malformed
    // input as parse diagnostics on the returned SourceFile and does not
    // throw. Checked against `function (((`, `class { {{{`, NUL bytes, a
    // truncated call and pure punctuation -- every one returned a SourceFile.
    //
    // A planted negative for this branch therefore PASSES, which is the
    // vacuous-plant shape: a claim whose falsifying case never occurs. The
    // guard stays because "TypeScript will never throw here" is not mine to
    // promise across versions, but nobody should write a test for it, and
    // nobody should read its absence as an oversight.
    //
    // If it ever does fire: yielding no evidence keeps the count a lower
    // bound, which is the safe direction. It must never yield a claim that
    // these sites are NOT refusals.
    return lines;
  }

  const enclosing: boolean[] = [];
  const visit = (node: ts.Node): void => {
    const isFunctionLike =
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isConstructorDeclaration(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node);
    if (isFunctionLike) {
      enclosing.push(
        (node as ts.SignatureDeclarationBase).parameters.some((p) => declaresUnknown(p.type)),
      );
    }
    if (ts.isThrowStatement(node) && enclosing.some(Boolean)) {
      lines.add(file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1);
    }
    ts.forEachChild(node, visit);
    if (isFunctionLike) enclosing.pop();
  };
  visit(file);
  return lines;
}

/** `throw new X(` on one line. A bare `throw err;` re-throw is not a site. */
const THROW_NEW = /\bthrow\s+new\s+[A-Za-z_$][\w$]*\s*\(/;

/**
 * Throw sites in one file that `scanRefusalThrowSites` does not record,
 * because no refusal code can be read off them.
 */
export function scanBareThrowSites(source: string, relPath: string): BareThrowSite[] {
  const coded = new Set(scanRefusalThrowSites(source, relPath).map((s) => s.line));
  const unknownLines = unknownParamThrowLines(source, relPath);
  const out: BareThrowSite[] = [];
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!THROW_NEW.test(line)) continue;
    if (coded.has(i + 1)) continue;
    const cls = /\bthrow\s+new\s+([A-Za-z_$][\w$]*)\s*\(/.exec(line)?.[1] ?? "";
    out.push({
      file: relPath,
      line: i + 1,
      snippet: line.trim(),
      errorClass: cls,
      projectDefinedClass: cls.length > 0 && !BUILTIN_ERROR_CLASSES.has(cls),
      enclosingTakesUnknown: unknownLines.has(i + 1),
    });
  }
  return out;
}

export interface BareThrowScanResult {
  /** Files holding at least one bare throw, in path order. */
  readonly byFile: ReadonlyMap<string, readonly BareThrowSite[]>;
  readonly totalBare: number;
  readonly totalCoded: number;
  readonly filesScanned: number;
  /** Per-root totals, so no root can be silently missing from the census. */
  readonly byRoot: ReadonlyMap<
    string,
    { readonly files: number; readonly bare: number; readonly coded: number }
  >;
  /**
   * Bare throws of a project-defined error class: a MEASURED LOWER BOUND on
   * how much of the bare block is refusal path, never a total. See am-kfkw.
   */
  readonly projectClassLowerBound: number;
  /**
   * A SECOND, disjoint lower bound: built-in-class bare throws whose enclosing
   * function takes an `unknown` parameter. Counted only among the built-in
   * remainder, so it never double-counts a project-class site and the two
   * bounds add.
   */
  readonly unknownParamLowerBound: number;
  /**
   * The combined lower bound on the refusal path: project class plus
   * unknown-parameter. Still a LOWER BOUND and never a total.
   */
  readonly refusalPathLowerBound: number;
  /** Bare throws of a built-in class: unclassified, which is not "not refusals". */
  readonly builtinClassUnclassified: number;
  /**
   * What neither signal reaches: the block source tagging would still have to
   * cover. builtinClassUnclassified minus unknownParamLowerBound.
   */
  readonly unreachedByEitherSignal: number;
  /** Site counts per project-defined error class, largest first. */
  readonly projectClassCounts: readonly (readonly [string, number])[];
}

/**
 * The roots this census covers.
 *
 * `findSourceFiles` is not used here, and deliberately. It takes a single
 * directory, and every caller passes `src`, so `scripts/` was never a source
 * root for any refusal instrument. It also skips anything under a `testing/`
 * directory. Measured on 2026-09-19 that hid 388 bare throws in `scripts/`
 * and 84 in `src/testing/**` -- 472 sites that were absent rather than zero,
 * which is the defect am-kfkw exists to fix. This walk covers both.
 */
export const BARE_THROW_ROOTS = ["src", "scripts"] as const;

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "artifacts", "out"]);

function walkAllSources(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walkAllSources(full));
    } else if (
      (entry.endsWith(".ts") || entry.endsWith(".tsx")) &&
      !entry.includes(".test.") &&
      !entry.includes(".spec.") &&
      !entry.includes(".cases.") &&
      !entry.includes(".fixture.")
    ) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Repository-wide bare throw census. Reported every run, including when it is
 * zero: a class that vanishes from a report is worse than one reported as
 * zero, because its absence reads as absence of the problem.
 */
export function scanBareThrows(rootDir: string): BareThrowScanResult {
  const byFile = new Map<string, readonly BareThrowSite[]>();
  const byRoot = new Map<string, { files: number; bare: number; coded: number }>();
  let totalBare = 0;
  let totalCoded = 0;
  let filesScanned = 0;

  for (const root of BARE_THROW_ROOTS) {
    // Every root is entered in the report, including one that contributes
    // nothing. A root that appears only when it has sites is a root whose
    // silence cannot be told from its absence.
    const tally = { files: 0, bare: 0, coded: 0 };
    byRoot.set(root, tally);
    for (const sf of walkAllSources(join(rootDir, root)).sort()) {
      const rel = relative(rootDir, sf);
      const content = readFileSync(sf, "utf8");
      const coded = new Set(scanRefusalThrowSites(content, rel).map((s) => s.line)).size;
      const bare = scanBareThrowSites(content, rel);
      tally.files += 1;
      tally.coded += coded;
      tally.bare += bare.length;
      filesScanned += 1;
      totalCoded += coded;
      if (bare.length > 0) {
        byFile.set(rel, bare);
        totalBare += bare.length;
      }
    }
  }

  let projectClassLowerBound = 0;
  let unknownParamLowerBound = 0;
  let builtinClassUnclassified = 0;
  const classCounts = new Map<string, number>();
  for (const sites of byFile.values()) {
    for (const site of sites) {
      if (site.projectDefinedClass) {
        projectClassLowerBound += 1;
        classCounts.set(site.errorClass, (classCounts.get(site.errorClass) ?? 0) + 1);
      } else {
        builtinClassUnclassified += 1;
        if (site.enclosingTakesUnknown) unknownParamLowerBound += 1;
      }
    }
  }

  return {
    byFile,
    totalBare,
    totalCoded,
    filesScanned,
    byRoot,
    projectClassLowerBound,
    unknownParamLowerBound,
    refusalPathLowerBound: projectClassLowerBound + unknownParamLowerBound,
    builtinClassUnclassified,
    unreachedByEitherSignal: builtinClassUnclassified - unknownParamLowerBound,
    projectClassCounts: [...classCounts.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    ),
  };
}
