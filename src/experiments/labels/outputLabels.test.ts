/**
 * Every output a laboratory publishes is named in words in its model note (dispatch 218): by the
 * quantity registry when the output id is a registered quantity, else by OUTPUT_LABELS. Before
 * this table, 240 of the 339 output ids the live notes showed fell back to a spelled-out id.
 *
 * The contracts are read from the experiments themselves - each definition's exported *_OUTPUTS
 * records, plus the three modules that declare outputs outside a definition - so an output added
 * to a lab without a name fails here, not on the page.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { QUANTITY_LABELS } from "../../generated/quantity-labels.ts";
import { LIGHT_THREAD_QUANTITIES } from "../../physics/reference/lightThread.ts";
import { outputName } from "./ModelNote.tsx";
import { OUTPUT_LABELS } from "./outputLabels.ts";

const EXPERIMENTS = fileURLToPath(new URL("../", import.meta.url));
/** Modules that declare lab outputs outside a definition.ts. */
const EXTRA = ["sr08/forceLedger.ts", "sr08/session.ts", "lightThread/session.ts"];

/** Output id -> the experiment directories that publish it. */
async function outputContracts(): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  const files = [
    ...readdirSync(EXPERIMENTS)
      .map((dir) => join(dir, "definition.ts"))
      .filter((f) => existsSync(join(EXPERIMENTS, f))),
    ...EXTRA,
  ];
  for (const file of files) {
    const mod = (await import(join(EXPERIMENTS, file))) as Record<string, unknown>;
    for (const [name, value] of Object.entries(mod)) {
      if (!name.includes("OUTPUT") || !value || typeof value !== "object") continue;
      for (const [id, contract] of Object.entries(value as Record<string, unknown>)) {
        if (!contract || typeof contract !== "object" || !("semanticKind" in contract)) continue;
        const labs = out.get(id) ?? new Set<string>();
        labs.add(file.split("/")[0] ?? file);
        out.set(id, labs);
      }
    }
  }
  return out;
}

describe("every lab output is named in words", () => {
  test("the enumeration reaches the labs' contracts", async () => {
    const contracts = await outputContracts();
    // Non-vacuity: a broken import or a renamed export would make every later check pass on
    // nothing. ME-03's boundary ledger and SR-13's electron outputs are both reached.
    expect(contracts.get("systemMassChange")?.has("me03")).toBe(true);
    expect(contracts.get("lorentzFactor")?.has("sr13")).toBe(true);
    expect(contracts.size).toBeGreaterThan(300);
  });

  test("each output of every lab has a registry name or an output label", async () => {
    const contracts = await outputContracts();
    const unnamed = [...contracts.keys()].filter(
      (id) => QUANTITY_LABELS[id] === undefined && OUTPUT_LABELS[id] === undefined,
    );
    expect(unnamed).toEqual([]);
  });

  test("the light-thread lab's outputs keep the names its own page gives them", async () => {
    // The lab labels its values in LIGHT_THREAD_QUANTITIES. The table repeats those words rather
    // than importing them, because the model note ships in every lab page and the import would
    // bring the light-thread physics with it; this check is what keeps the two from drifting.
    const contracts = await outputContracts();
    const ids = [...contracts].filter(([, labs]) => labs.has("lightThread")).map(([id]) => id);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const own = LIGHT_THREAD_QUANTITIES[id as keyof typeof LIGHT_THREAD_QUANTITIES];
      expect(own).toBeDefined();
      expect(OUTPUT_LABELS[id]).toBe(own?.label);
    }
  });

  test("the model note names an output from the registry first, then this table", () => {
    expect(outputName("lorentzFactor")).toBe(QUANTITY_LABELS.lorentzFactor ?? "");
    expect(outputName("invariantMass")).toBe("Invariant mass of the emitted light");
    expect(outputName("systemMassChange")).toBe("Mass change of body and radiation together");
  });

  test("a label names a real output, never a registered quantity, in a reader's words", async () => {
    const contracts = await outputContracts();
    for (const [id, label] of Object.entries(OUTPUT_LABELS)) {
      // A stale label would name nothing; a label on a registered id would shadow the registry.
      expect(contracts.has(id)).toBe(true);
      expect(QUANTITY_LABELS[id]).toBeUndefined();
      expect(label.trim()).toBe(label);
      expect(label.length).toBeGreaterThan(3);
      expect(label).not.toMatch(/[a-z][A-Z]/);
      expect(label).not.toMatch(/\b(owner|snapshot|revision)\b/i);
    }
  });
});
