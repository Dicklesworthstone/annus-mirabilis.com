import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface EvidenceLink {
  ref: string;
  kind: "file" | "beadId" | "logRunId";
  line: number;
  resolved: boolean;
  message?: string;
}

export interface LinkCheckResult {
  filePath: string;
  totalLinks: number;
  resolvedLinks: number;
  unresolvedLinks: number;
  links: EvidenceLink[];
}

/**
 * Resolves a reference that may be a GLOB rather than a single path.
 *
 * `docs/decisions/foundation-library-scope.md` line 61 reads "reading every file under
 * `content/foundations/*.json`", which is correct prose about 45 files that exist. This checker had
 * no glob handling, so it resolved the literal string as a path and reported the document's one
 * accurate sentence as a broken reference -- the only unresolved link in any evidence document, and
 * a false one. Wiring this check into a runner while it did that would have produced a red gate on
 * correct prose, which is how people learn to ignore red gates.
 *
 * A glob still has to point AT something: this returns resolved only when at least one file matches,
 * and the message says how many, because "resolved" over a pattern that matched nothing and
 * "resolved" over a pattern that matched 45 files must not read the same.
 */
export function resolveReference(
  reference: string,
  baseDir: string,
): Readonly<{ resolved: boolean; message: string }> {
  const full = path.resolve(baseDir, reference);
  if (!/[*?]/.test(reference)) {
    return fs.existsSync(full)
      ? { resolved: true, message: "File exists" }
      : { resolved: false, message: `Referenced source file does not exist: ${full}` };
  }

  // The longest leading run of segments with no metacharacter is the directory to read.
  const segments = reference.split("/");
  const literal: string[] = [];
  for (const segment of segments) {
    if (/[*?]/.test(segment)) break;
    literal.push(segment);
  }
  const root = path.resolve(baseDir, literal.join("/"));
  if (!fs.existsSync(root)) {
    return { resolved: false, message: `Glob's directory does not exist: ${root}` };
  }

  const pattern = new RegExp(
    `^${segments
      .slice(literal.length)
      .join("/")
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*/g, "\u0000")
      .replace(/\*/g, "[^/]*")
      .replace(/\u0000/g, ".*")
      .replace(/\?/g, "[^/]")}$`,
  );

  const deep = reference.includes("**");
  const matches: string[] = [];
  const walk = (dir: string, prefix: string, depth: number) => {
    // Bounded so a deep or looping tree cannot hang the check. Matching is NOT short-circuited at
    // the first hit, because the count goes into the message.
    if (depth > 8) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (deep) walk(path.join(dir, entry.name), relative, depth + 1);
        continue;
      }
      if (pattern.test(relative)) matches.push(relative);
    }
  };
  walk(root, "", 0);

  return matches.length > 0
    ? { resolved: true, message: `Glob matches ${matches.length} file(s) under ${root}` }
    : { resolved: false, message: `Glob matches no file under ${root}` };
}

export function checkEvidenceLinksInContent(
  content: string,
  filePath: string,
  baseDir = process.cwd(),
): LinkCheckResult {
  const lines = content.split("\n");
  const links: EvidenceLink[] = [];
  const documentDir = path.dirname(path.resolve(baseDir, filePath));

  for (let lineNum = 1; lineNum <= lines.length; lineNum++) {
    const line = lines[lineNum - 1] || "";

    // 1. Check markdown links: [text](link)
    const mdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    for (const mdMatch of line.matchAll(mdLinkRegex)) {
      const url = mdMatch[2];
      if (!url) continue;
      if (url.startsWith("file://")) {
        let targetPath: string;
        try {
          targetPath = fileURLToPath(url);
        } catch {
          links.push({
            ref: url,
            kind: "file",
            line: lineNum,
            resolved: false,
            message: "Invalid file URL",
          });
          continue;
        }
        const exists = fs.existsSync(targetPath);
        links.push({
          ref: url,
          kind: "file",
          line: lineNum,
          resolved: exists,
          message: exists ? "File exists" : `Referenced file does not exist: ${targetPath}`,
        });
      } else if (
        !url.startsWith("http://") &&
        !url.startsWith("https://") &&
        !url.startsWith("#")
      ) {
        const targetPath = path.isAbsolute(url) ? url : path.resolve(documentDir, url);
        const exists = fs.existsSync(targetPath);
        links.push({
          ref: url,
          kind: "file",
          line: lineNum,
          resolved: exists,
          message: exists
            ? "File exists"
            : `Referenced relative file does not exist: ${targetPath}`,
        });
      }
    }

    // 2. Check inline backtick file paths
    const inlineCodeRegex = /`([^`]+)`/g;
    for (const codeMatch of line.matchAll(inlineCodeRegex)) {
      const text = codeMatch[1];
      if (!text) continue;

      // Check if it looks like a relative file path (contains / and extension like .ts, .tsx, .mjs, .md)
      if (
        (text.startsWith("src/") ||
          text.startsWith("docs/") ||
          text.startsWith("scripts/") ||
          text.startsWith("content/") ||
          text.startsWith("artifacts/")) &&
        (text.endsWith(".ts") ||
          text.endsWith(".tsx") ||
          text.endsWith(".mjs") ||
          text.endsWith(".md") ||
          text.endsWith(".json") ||
          text.endsWith(".yaml"))
      ) {
        const outcome = resolveReference(text, baseDir);
        links.push({
          ref: text,
          kind: "file",
          line: lineNum,
          resolved: outcome.resolved,
          message: outcome.message,
        });
      }

      // Check bead IDs: `am-[a-z0-9-]+`
      if (/^am-[a-z0-9-]+$/.test(text)) {
        links.push({
          ref: text,
          kind: "beadId",
          line: lineNum,
          resolved: true,
          message: "Bead ID well-formed",
        });
      }
    }
  }

  const resolvedLinks = links.filter((l) => l.resolved).length;
  const unresolvedLinks = links.filter((l) => !l.resolved).length;

  return {
    filePath,
    totalLinks: links.length,
    resolvedLinks,
    unresolvedLinks,
    links,
  };
}

export function checkEvidenceLinksFile(
  targetFilePath: string,
  baseDir = process.cwd(),
): LinkCheckResult {
  const fullPath = path.isAbsolute(targetFilePath)
    ? targetFilePath
    : path.resolve(baseDir, targetFilePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Target file not found: ${fullPath}`);
  }
  const content = fs.readFileSync(fullPath, "utf8");
  return checkEvidenceLinksInContent(content, targetFilePath, baseDir);
}

// CLI Execution
/**
 * THE EVIDENCE DOCUMENTS THIS CHECKS BY DEFAULT.
 *
 * It used to default to ONE hard-coded file, docs/decisions/batch-b-retrospective.md, which resolves
 * 92/92 — so running it as shipped said nothing about the four documents beside it, and the one
 * unresolved reference in the corpus sat in a document the default never opened. That is the mild
 * form of the hazard AGENTS.md puts first: a run that examined one of five reads exactly like a run
 * that examined all five.
 *
 * An explicit path argument still checks just that file.
 */
const EVIDENCE_DIRECTORIES = Object.freeze(["docs/evidence", "docs/decisions"]);

export function defaultEvidenceDocuments(): string[] {
  const found: string[] = [];
  for (const directory of EVIDENCE_DIRECTORIES) {
    const full = path.resolve(process.cwd(), directory);
    if (!fs.existsSync(full)) continue;
    for (const entry of fs.readdirSync(full)) {
      if (entry.endsWith(".md")) found.push(path.join(directory, entry));
    }
  }
  return found.sort();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const explicit = process.argv[2];
  const targets = explicit ? [explicit] : defaultEvidenceDocuments();
  try {
    // A run over no documents is not a clean run.
    if (targets.length === 0) {
      console.error(
        `[check-evidence-links] NO EVIDENCE DOCUMENTS FOUND under ${EVIDENCE_DIRECTORIES.join(", ")}. A check that examined nothing is not a pass.`,
      );
      process.exit(1);
    }

    const logDir = path.resolve(process.cwd(), "artifacts/test-logs/retrospective-links");
    fs.mkdirSync(logDir, { recursive: true });
    const logRunId = `links-run-${Date.now()}`;
    const logFile = path.join(logDir, `${logRunId}.jsonl`);
    const logEntries: Record<string, unknown>[] = [];

    let totalLinks = 0;
    let totalUnresolved = 0;
    const failures: string[] = [];

    for (const targetFile of targets) {
      const result = checkEvidenceLinksFile(targetFile);
      totalLinks += result.totalLinks;
      totalUnresolved += result.unresolvedLinks;
      for (const link of result.links) {
        logEntries.push({
          timestamp: new Date().toISOString(),
          suite: "retrospective-links",
          logRunId,
          testId: "evidence-links-check",
          beadId: "am-bm-slice-retrospective-pp09",
          document: targetFile,
          ref: link.ref,
          kind: link.kind,
          line: link.line,
          resolved: link.resolved,
          outcome: link.resolved ? "pass" : "fail",
          message: link.message || "",
        });
      }
      console.log(
        `[check-evidence-links] ${targetFile}: ${result.resolvedLinks}/${result.totalLinks} links resolved`,
      );
      for (const l of result.links.filter((x) => !x.resolved)) {
        failures.push(`  ${targetFile} line ${l.line}: ${l.ref} (${l.message})`);
      }
    }

    fs.writeFileSync(logFile, `${logEntries.map((e) => JSON.stringify(e)).join("\n")}\n`);

    // The denominator, beside the verdict, in the form the licence inventory uses.
    console.error(
      `[check-evidence-links] ${targets.length} document(s), ${totalLinks} reference(s), ${totalUnresolved} unresolved; log artifacts/test-logs/retrospective-links/${logRunId}.jsonl`,
    );
    if (failures.length > 0) {
      console.error(`Found ${totalUnresolved} unresolved reference(s):`);
      for (const line of failures) console.error(line);
      process.exit(1);
    }
  } catch (err) {
    console.error(`[check-evidence-links] Error:`, err);
    process.exit(1);
  }
}
