import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function extractKernelIdTableBlock(markdown: string): string {
  const match = markdown.match(/```kernel-id-table\n([\s\S]*?)\n```/);
  if (!match?.[1]) {
    throw new Error("Could not find ```kernel-id-table ... ``` block in document.");
  }
  return match[1].trim();
}

interface ParsedRow {
  id: number;
  idHex: string;
  idDec: number;
  name: string;
  status: string;
  indexRule: string;
  consumers: string[];
  allocationIds: string[];
  tileFormula: string;
  notes?: string | undefined;
  block: "production" | "test-fixture";
}

interface ParsedTable {
  schema: string;
  pin: string;
  streamSemanticsVersion: number;
  unallocatedGap: { start: number; end: number };
  blocks: {
    production: { range: { start: number; end: number }; rows: ParsedRow[] };
    testFixture: { range: { start: number; end: number }; rows: ParsedRow[] };
  };
  rows: ParsedRow[];
}

function parseKernelIdTable(raw: string): ParsedTable {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let currentBlock: "production" | "test-fixture" | null = null;

  const result: ParsedTable = {
    schema: "",
    pin: "",
    streamSemanticsVersion: 0,
    unallocatedGap: { start: 0, end: 0 },
    blocks: {
      production: { range: { start: 0, end: 0 }, rows: [] },
      testFixture: { range: { start: 0, end: 0 }, rows: [] },
    },
    rows: [],
  };

  for (const line of lines) {
    if (line.startsWith("schema=")) {
      result.schema = line.split("=")[1] ?? "";
    } else if (line.startsWith("pin=")) {
      result.pin = line.split("=")[1] ?? "";
    } else if (line.startsWith("streamSemanticsVersion=")) {
      result.streamSemanticsVersion = parseInt(line.split("=")[1] ?? "0", 10);
    } else if (line.startsWith("unallocatedGap=")) {
      const parts = (line.split("=")[1] ?? "").split("..");
      result.unallocatedGap = {
        start: parseInt(parts[0] ?? "0", 16),
        end: parseInt(parts[1] ?? "0", 16),
      };
    } else if (line.startsWith("BEGIN block=")) {
      const blockName = line.split("=")[1];
      if (blockName === "production" || blockName === "test-fixture") {
        currentBlock = blockName;
      } else {
        throw new Error(`Unknown block: ${blockName}`);
      }
    } else if (line.startsWith("END block=")) {
      currentBlock = null;
    } else if (line.startsWith("RANGE ")) {
      const parts = line.split(" ");
      const range = {
        start: parseInt(parts[1] ?? "0", 16),
        end: parseInt(parts[2] ?? "0", 16),
      };
      if (currentBlock === "production") {
        result.blocks.production.range = range;
      } else if (currentBlock === "test-fixture") {
        result.blocks.testFixture.range = range;
      }
    } else if (line.startsWith("ROW ")) {
      if (!currentBlock) {
        throw new Error(`Row outside of block: ${line}`);
      }
      const pairs = line.substring(4).split(" ");
      const rowData: Record<string, string> = {};
      for (const pair of pairs) {
        const idx = pair.indexOf("=");
        if (idx !== -1) {
          const k = pair.substring(0, idx);
          const v = pair.substring(idx + 1);
          rowData[k] = v;
        }
      }

      const activeBlock: "production" | "test-fixture" = currentBlock;

      const row: ParsedRow = {
        id: parseInt(rowData.id ?? "0", 16),
        idHex: rowData.id ?? "",
        idDec: parseInt(rowData.idDec ?? "0", 10),
        name: rowData.name ?? "",
        status: rowData.status ?? "",
        indexRule: rowData.indexRule ?? "",
        consumers: rowData.consumers?.split(",") ?? [],
        allocationIds: rowData.allocationIds?.split(",") ?? [],
        tileFormula: rowData.tileFormula ?? "",
        notes: rowData.notes,
        block: activeBlock,
      };

      result.rows.push(row);
      if (activeBlock === "production") {
        result.blocks.production.rows.push(row);
      } else {
        result.blocks.testFixture.rows.push(row);
      }
    }
  }

  return result;
}

describe("Binding Mirror: Parity between FRANKENSIM_BINDING.md and STREAM_ALLOCATION.md", () => {
  const bindingPath = resolve(process.cwd(), "docs/FRANKENSIM_BINDING.md");
  const allocationPath = resolve(process.cwd(), "docs/STREAM_ALLOCATION.md");

  const bindingContent = readFileSync(bindingPath, "utf-8");
  const allocationContent = readFileSync(allocationPath, "utf-8");

  const bindingBlock = extractKernelIdTableBlock(bindingContent);
  const allocationBlock = extractKernelIdTableBlock(allocationContent);

  it("extracts identical kernel-id-table blocks byte-for-byte", () => {
    expect(allocationBlock).toBe(bindingBlock);
  });

  it("verifies parsed kernel table invariants and structure", () => {
    const table = parseKernelIdTable(allocationBlock);

    expect(table.schema).toBe("am.kernel-id-table.v1");
    expect(table.streamSemanticsVersion).toBe(1);

    // Check ranges
    expect(table.blocks.production.range.start).toBe(0x19050000);
    expect(table.blocks.production.range.end).toBe(0x19050fff);
    expect(table.blocks.testFixture.range.start).toBe(0x1905f000);
    expect(table.blocks.testFixture.range.end).toBe(0x1905ffff);

    // Check unallocated gap
    expect(table.unallocatedGap.start).toBe(0x19051000);
    expect(table.unallocatedGap.end).toBe(0x1905efff);

    // Verify row properties
    const seenIds = new Set<number>();
    const seenNames = new Set<string>();

    for (const row of table.rows) {
      // Unique ID
      expect(seenIds.has(row.id)).toBe(false);
      seenIds.add(row.id);

      // Unique Name
      expect(seenNames.has(row.name)).toBe(false);
      seenNames.add(row.name);

      // Status
      expect(["active", "retired"]).toContain(row.status);

      // Index rule is draws
      expect(row.indexRule).toBe("draws");

      // Check block range containment
      if (row.block === "production") {
        expect(row.id).toBeGreaterThanOrEqual(table.blocks.production.range.start);
        expect(row.id).toBeLessThanOrEqual(table.blocks.production.range.end);
      } else {
        expect(row.id).toBeGreaterThanOrEqual(table.blocks.testFixture.range.start);
        expect(row.id).toBeLessThanOrEqual(table.blocks.testFixture.range.end);
      }

      // Must not be in unallocated gap
      expect(row.id >= table.unallocatedGap.start && row.id <= table.unallocatedGap.end).toBe(
        false,
      );
    }

    // Check specific rows
    const exerciseRow = table.rows.find((r) => r.name === "exercise-sample-points");
    expect(exerciseRow).toBeDefined();
    expect(exerciseRow?.idHex).toBe("0x19050006");
    expect(exerciseRow?.block).toBe("production");
    expect(exerciseRow?.allocationIds).toContain("exercise.sample-points.v1");

    const latentRow = table.rows.find((r) => r.name === "brownian-latent");
    expect(latentRow).toBeDefined();
    expect(latentRow?.idHex).toBe("0x19050001");
    expect(latentRow?.allocationIds).toContain("bm-01.latent.v1");
    expect(latentRow?.allocationIds).toContain("bm-05.walk.v1");
  });
});
