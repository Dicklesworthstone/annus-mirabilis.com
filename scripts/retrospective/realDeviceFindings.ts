import fs from "node:fs";
import path from "node:path";

export interface RealDeviceFinding {
  findingId: string;
  device: string;
  sourceFile: string;
  tag: string;
  area: string;
  observation: string;
}

export interface DecisionFindingRow {
  findingId: string;
  device: string;
  sourceRecord: string;
  decision: string;
}

export function parseRealDeviceRecords(dirPath: string): RealDeviceFinding[] {
  if (!fs.existsSync(dirPath)) return [];
  const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".md"));
  const findings: RealDeviceFinding[] = [];

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const content = fs.readFileSync(fullPath, "utf8");

    // Extract device
    const deviceMatch = content.match(/\*\*Device:\*\*\s*([^\n]+)/);
    const rawDevice = deviceMatch?.[1];
    const device = rawDevice
      ? rawDevice
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "-")
      : file.replace(".md", "");

    // Extract finding sections
    const sections = content.split(/###\s+(FINDING-[A-Z0-9-]+)/);
    for (let i = 1; i < sections.length; i += 2) {
      const rawId = sections[i];
      if (!rawId) continue;
      const findingId = rawId.trim();
      const body = sections[i + 1] || "";

      const tagMatch = body.match(/-\s*\*\*Tag:\*\*\s*([^\n]+)/);
      const areaMatch = body.match(/-\s*\*\*Area:\*\*\s*([^\n]+)/);
      const obsMatch = body.match(/-\s*\*\*Observation:\*\*\s*([^\n]+)/);

      findings.push({
        findingId,
        device,
        sourceFile: path.relative(process.cwd(), fullPath),
        tag: tagMatch?.[1]?.trim() || "display-only",
        area: areaMatch?.[1]?.trim() || "",
        observation: obsMatch?.[1]?.trim() || "",
      });
    }
  }

  return findings;
}

export function parseDecisionsFindingsTable(markdown: string): DecisionFindingRow[] {
  const lines = markdown.split("\n");
  const rows: DecisionFindingRow[] = [];
  let inTable = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.startsWith("|") &&
      trimmed.includes("Finding ID") &&
      trimmed.includes("Architecture Decision")
    ) {
      inTable = true;
      continue;
    }
    if (
      inTable &&
      trimmed.startsWith("|") &&
      (trimmed.includes("---|") || trimmed.includes("--- |"))
    ) {
      continue;
    }
    if (inTable && trimmed.startsWith("|")) {
      const cols = trimmed
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim().replace(/^`|`$/g, ""));
      if (cols.length >= 4) {
        rows.push({
          findingId: cols[0] ?? "",
          device: cols[1] ?? "",
          sourceRecord: cols[2] ?? "",
          decision: cols[3] ?? "",
        });
      }
    } else if (inTable && !trimmed.startsWith("|")) {
      inTable = false;
    }
  }

  return rows;
}

export function verifyRealDeviceFindings(
  findings: RealDeviceFinding[],
  decisions: DecisionFindingRow[],
): {
  verified: boolean;
  missingDecisions: string[];
  phantomFindings: string[];
} {
  const archFindings = findings.filter((f) => f.tag === "architecture-relevant");
  const decisionMap = new Map<string, DecisionFindingRow>(decisions.map((d) => [d.findingId, d]));
  const findingMap = new Map<string, RealDeviceFinding>(findings.map((f) => [f.findingId, f]));

  const missingDecisions: string[] = [];
  for (const f of archFindings) {
    if (!decisionMap.has(f.findingId) || !decisionMap.get(f.findingId)?.decision) {
      missingDecisions.push(f.findingId);
    }
  }

  const phantomFindings: string[] = [];
  for (const d of decisions) {
    if (!findingMap.has(d.findingId)) {
      phantomFindings.push(d.findingId);
    }
  }

  return {
    verified: missingDecisions.length === 0 && phantomFindings.length === 0,
    missingDecisions,
    phantomFindings,
  };
}
