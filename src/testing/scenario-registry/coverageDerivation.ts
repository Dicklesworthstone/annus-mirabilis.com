import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

export const FIXTURE_SEARCH_DIRS = [
  "content/scenarios",
  "src/testing/scenario-fixtures",
  "src/testing/scenario-registry",
  "src/testing/scenarios",
  "content/experiments",
  "src/testing",
] as const;

function walk(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, acc);
    } else {
      acc.push(full);
    }
  }
  return acc;
}

export interface FixtureResolution {
  readonly exists: boolean;
  readonly path?: string;
}

export function buildFixtureIndex(root = process.cwd()): Map<string, string> {
  const index = new Map<string, string>();
  for (const relDir of FIXTURE_SEARCH_DIRS) {
    const absDir = join(root, relDir);
    const files = walk(absDir);
    for (const f of files) {
      if (!/\.(yaml|yml|ts|tsx|mjs|js)$/.test(f)) continue;
      const text = readFileSync(f, "utf8");
      const relPath = relative(root, f).split("\\").join("/");

      // 1. Check YAML id:
      const yamlId = text.match(/^id:\s*["']?([^\s#]+)["']?\s*$/m);
      if (yamlId && yamlId[1] !== undefined) {
        index.set(yamlId[1].replace(/["']/g, ""), relPath);
      }

      // 2. Check acceptanceCases array in experiments or scenario references
      const accMatches = text.matchAll(/-\s+([^\s#]+)\s*$/gm);
      for (const m of accMatches) {
        if (m[1] !== undefined && !index.has(m[1])) {
          index.set(m[1].replace(/["']/g, ""), relPath);
        }
      }
    }
  }
  return index;
}

export function resolveScenarioFixture(
  scenarioId: string,
  root = process.cwd(),
  fixtureIndex?: ReadonlyMap<string, string>,
): FixtureResolution {
  const index = fixtureIndex ?? buildFixtureIndex(root);
  const path = index.get(scenarioId);
  if (path !== undefined) {
    return { exists: true, path };
  }
  return { exists: false };
}

export interface ParsedCoverageRow {
  readonly sectionTitle: string;
  readonly scenarioId: string;
  readonly fixtureStatus: "built" | "owed" | undefined;
  readonly cells: readonly string[];
  readonly headerCells: readonly string[];
  readonly lineIndex: number;
}

export function parseScenarioCoverageMarkdown(markdown: string): ParsedCoverageRow[] {
  const lines = markdown.split("\n");
  const rows: ParsedCoverageRow[] = [];
  let currentSection = "";
  let currentHeaders: string[] = [];
  let scenarioIdColIndex = -1;
  let fixtureColIndex = -1;
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? "";
    if (line.startsWith("#")) {
      currentSection = line.replace(/^#+\s*/, "");
      inTable = false;
      continue;
    }

    if (!line.startsWith("|")) {
      inTable = false;
      continue;
    }

    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);

    if (cells.length === 0) continue;

    // Check if this is a header row
    const isHeader = cells.some((c) => c === "Scenario id" || c === "id");
    if (isHeader) {
      currentHeaders = cells;
      scenarioIdColIndex = cells.findIndex((c) => c === "Scenario id" || c === "id");
      fixtureColIndex = cells.findIndex((c) => c === "Fixture" || c === "Status" || c === "State");
      inTable = true;
      continue;
    }

    // Skip delimiter row
    if (cells.every((c) => /^:?-+:?$/.test(c))) {
      continue;
    }

    if (inTable && scenarioIdColIndex >= 0 && scenarioIdColIndex < cells.length) {
      const scenarioId = cells[scenarioIdColIndex];
      if (!scenarioId || scenarioId.length === 0) continue;

      let fixtureStatus: "built" | "owed" | undefined;
      // First check if there is an explicit Fixture column
      const explicitFixtureIndex = currentHeaders.findIndex(
        (c) => c === "Fixture" || c === "Fixture status",
      );
      if (explicitFixtureIndex >= 0 && explicitFixtureIndex < cells.length) {
        const val = cells[explicitFixtureIndex]?.toLowerCase();
        if (val === "built" || val === "owed") {
          fixtureStatus = val;
        }
      } else if (fixtureColIndex >= 0 && fixtureColIndex < cells.length) {
        // Fallback to Status/State column if value is built/owed
        const val = cells[fixtureColIndex]?.toLowerCase();
        if (val === "built" || val === "owed") {
          fixtureStatus = val;
        }
      }

      rows.push({
        sectionTitle: currentSection,
        scenarioId,
        fixtureStatus,
        cells,
        headerCells: currentHeaders,
        lineIndex: i,
      });
    }
  }

  return rows;
}

export function deriveScenarioCoverageMarkdown(markdown: string, root = process.cwd()): string {
  const index = buildFixtureIndex(root);
  const lines = markdown.split("\n");
  const resultLines: string[] = [];

  let currentHeaders: string[] = [];
  let scenarioIdColIndex = -1;
  let fixtureColIndex = -1;
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? "";
    const trimmed = rawLine.trim();

    if (trimmed.startsWith("#")) {
      inTable = false;
      resultLines.push(rawLine);
      continue;
    }

    if (!trimmed.startsWith("|")) {
      inTable = false;
      resultLines.push(rawLine);
      continue;
    }

    const rawCells = trimmed
      .split("|")
      .map((c) => c.trim())
      .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);

    if (rawCells.length === 0) {
      resultLines.push(rawLine);
      continue;
    }

    const isHeader = rawCells.some((c) => c === "Scenario id" || c === "id");
    if (isHeader) {
      inTable = true;
      scenarioIdColIndex = rawCells.findIndex((c) => c === "Scenario id" || c === "id");

      // Normalize 'id' to 'Scenario id'
      const normalizedCells = [...rawCells];
      if (normalizedCells[scenarioIdColIndex] === "id") {
        normalizedCells[scenarioIdColIndex] = "Scenario id";
      }

      // Check if 'Fixture' column already exists
      fixtureColIndex = normalizedCells.findIndex((c) => c === "Fixture" || c === "Fixture status");
      if (fixtureColIndex === -1) {
        // Insert Fixture right after Scenario id
        fixtureColIndex = scenarioIdColIndex + 1;
        normalizedCells.splice(fixtureColIndex, 0, "Fixture");
      }

      currentHeaders = normalizedCells;
      resultLines.push(`| ${normalizedCells.join(" | ")} |`);
      continue;
    }

    // Delimiter row
    if (rawCells.every((c) => /^:?-+:?$/.test(c))) {
      const delimiterCells = currentHeaders.map(() => "---");
      resultLines.push(`| ${delimiterCells.join(" | ")} |`);
      continue;
    }

    if (inTable && scenarioIdColIndex >= 0) {
      const scenarioId = rawCells[scenarioIdColIndex] ?? "";
      const exists = index.has(scenarioId);
      const derivedStatus: "built" | "owed" = exists ? "built" : "owed";

      const updatedCells = [...rawCells];
      const existingFixtureCol = currentHeaders.findIndex(
        (c) => c === "Fixture" || c === "Fixture status",
      );

      if (existingFixtureCol >= 0 && rawCells.length === currentHeaders.length) {
        // Replace existing fixture column
        updatedCells[existingFixtureCol] = derivedStatus;
      } else {
        // Insert fixture column at fixtureColIndex
        updatedCells.splice(fixtureColIndex, 0, derivedStatus);
      }

      resultLines.push(`| ${updatedCells.join(" | ")} |`);
      continue;
    }

    resultLines.push(rawLine);
  }

  return resultLines.join("\n");
}

export function assertScenarioCoverage(
  markdown: string,
  root = process.cwd(),
): { total: number; built: number; owed: number } {
  const index = buildFixtureIndex(root);
  const rows = parseScenarioCoverageMarkdown(markdown);

  if (rows.length === 0) {
    throw new Error("No scenario rows found in docs/SCENARIO_COVERAGE.md");
  }

  let builtCount = 0;
  let owedCount = 0;

  for (const row of rows) {
    const { scenarioId, fixtureStatus } = row;
    const fixture = resolveScenarioFixture(scenarioId, root, index);

    if (fixtureStatus === "built") {
      if (!fixture.exists) {
        throw new Error(
          `Overclaim detected: Scenario "${scenarioId}" is marked as "built" in docs/SCENARIO_COVERAGE.md, but no fixture exists on disk.`,
        );
      }
      builtCount++;
    } else if (fixtureStatus === "owed") {
      if (fixture.exists) {
        throw new Error(
          `Underclaim detected: Scenario "${scenarioId}" is marked as "owed" in docs/SCENARIO_COVERAGE.md, but fixture was found at "${fixture.path}".`,
        );
      }
      owedCount++;
    } else {
      throw new Error(
        `Scenario "${scenarioId}" in section "${row.sectionTitle}" is missing a valid built/owed fixture status in docs/SCENARIO_COVERAGE.md (found: "${fixtureStatus}").`,
      );
    }
  }

  return { total: rows.length, built: builtCount, owed: owedCount };
}
