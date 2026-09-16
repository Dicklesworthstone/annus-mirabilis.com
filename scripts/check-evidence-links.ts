import fs from "node:fs";
import path from "node:path";

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

export function checkEvidenceLinksInContent(
  content: string,
  filePath: string,
  baseDir = process.cwd(),
): LinkCheckResult {
  const lines = content.split("\n");
  const links: EvidenceLink[] = [];

  for (let lineNum = 1; lineNum <= lines.length; lineNum++) {
    const line = lines[lineNum - 1] || "";

    // 1. Check markdown links: [text](link)
    const mdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    for (const mdMatch of line.matchAll(mdLinkRegex)) {
      const url = mdMatch[2];
      if (!url) continue;
      if (url.startsWith("file://")) {
        const targetPath = url.replace("file://", "");
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
        const targetPath = path.isAbsolute(url) ? url : path.resolve(baseDir, url);
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
        const fullPath = path.resolve(baseDir, text);
        const exists = fs.existsSync(fullPath);
        links.push({
          ref: text,
          kind: "file",
          line: lineNum,
          resolved: exists,
          message: exists ? "File exists" : `Referenced source file does not exist: ${fullPath}`,
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
if (import.meta.url === `file://${process.argv[1]}`) {
  const targetFile = process.argv[2] || "docs/decisions/batch-b-retrospective.md";
  try {
    const result = checkEvidenceLinksFile(targetFile);
    const logDir = path.resolve(process.cwd(), "artifacts/test-logs/retrospective-links");
    fs.mkdirSync(logDir, { recursive: true });
    const logRunId = `links-run-${Date.now()}`;
    const logFile = path.join(logDir, `${logRunId}.jsonl`);

    const logEntries = result.links.map((link) => ({
      timestamp: new Date().toISOString(),
      suite: "retrospective-links",
      logRunId,
      testId: "evidence-links-check",
      beadId: "am-bm-slice-retrospective-pp09",
      ref: link.ref,
      kind: link.kind,
      line: link.line,
      resolved: link.resolved,
      outcome: link.resolved ? "pass" : "fail",
      message: link.message || "",
    }));

    fs.writeFileSync(logFile, `${logEntries.map((e) => JSON.stringify(e)).join("\n")}\n`);

    console.log(
      `[check-evidence-links] ${targetFile}: ${result.resolvedLinks}/${result.totalLinks} links resolved`,
    );
    if (result.unresolvedLinks > 0) {
      console.error(`Found ${result.unresolvedLinks} unresolved links:`);
      for (const l of result.links.filter((x) => !x.resolved)) {
        console.error(`  Line ${l.line}: ${l.ref} (${l.message})`);
      }
      process.exit(1);
    }
  } catch (err) {
    console.error(`[check-evidence-links] Error:`, err);
    process.exit(1);
  }
}
