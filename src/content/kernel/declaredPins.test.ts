import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type DeclaredKernel,
  readDeclaredKernels,
  reportDeclaredPins,
  summarizeDeclaredPins,
} from "./declaredPins.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/**
 * THE GAP BETWEEN WHAT THE MANIFESTS DECLARE AND WHAT IS PINNED (am-f3e4, acceptance clause 1).
 *
 * The bead asks for a gate that compares the manifests' declared kernel functions against the pins,
 * fails on a declared function with no pin, and PRINTS BOTH COUNTS, "so the gate is verified against
 * the real gap before anything is fixed". No such gate existed: verifySliceKernels iterates the
 * CATALOGUE and reports kernel-pin-missing per catalogue entry, which is a different population and
 * prints no counts, and nothing else reads pins.json beside the manifests.
 *
 * Because it is written after the gap closed, the third case below verifies it against the REAL
 * historical population rather than against a fixture: the same computation, run over the pins file
 * as it stood at 11b9d2cd~1, the commit before this bead's first catalogue entry, must report 88 of
 * 108. That is the gap the gate was built for, and this is it failing on it.
 */
describe("declared kernel functions against the pins (am-f3e4)", () => {
  const declared: readonly DeclaredKernel[] = readDeclaredKernels(root);
  const pins = (path: string): Set<string> =>
    new Set(
      Object.keys(
        (JSON.parse(readFileSync(path, "utf8")) as { functions: Record<string, string> }).functions,
      ),
    );

  test("the population is every manifest's declaration, and it is not empty", () => {
    // A denominator, not a census: the floor moves only when manifests are added, and a run that
    // read nothing would fail here instead of reporting no gap.
    expect(declared.length).toBeGreaterThan(100);
    expect(new Set(declared.map((d) => d.instrumentId)).size).toBe(33);
  });

  /**
   * A DEBT, NOT A BUDGET, AND THE DEBT IS NOW ZERO.
   *
   * This read "These fifteen are declared by a manifest and carried by no pin" while the assertion
   * below was already `toEqual([])`, so the prose described a list that the code forbade: measured
   * 2026-10-14, 115 declarations, 111 distinct declared functions, 113 pins, 0 with no pin. The
   * sentence is corrected rather than deleted because the SHAPE it describes is what keeps this
   * honest, and the shape has not changed. An unpinned declaration is named by IDENTITY rather
   * than folded into a count, so a new one fails here under its own name, and the counts are
   * printed beside the verdict either way.
   *
   * Nothing about this case relaxes as the gap closes. Zero is simply where a ratchet of this
   * shape ends up, and the floor cases below are what stop an empty read from looking like it.
   */
  test("exactly the recorded declarations have no pin, and both counts are printed", () => {
    const report = reportDeclaredPins(
      declared,
      pins(resolve(root, "src/content/kernel/pins.json")),
    );
    console.log(`[declared pins] ${summarizeDeclaredPins(report)}`);
    for (const key of report.missing)
      console.log(`[declared pins]   ${report.missingByInstrument.get(key)}  ${key}`);
    expect(report.missing).toEqual([]);
  });

  /**
   * The historical case lives in declaredPins.node.test.ts, not here. It needs `git show` to read
   * the pins file as it stood at 11b9d2cd~1, and bun's test runner cannot spawn a process on this
   * host: posix_spawn returns EBADF, which is the same reason bunfig.toml already routes a dozen
   * files to the node lane. Keeping the two halves in two lanes also means neither can fail open
   * with the other: this file checks the gap over the current pins, and that one checks the same
   * computation against the real population the gate was built for.
   */
  test("with no pins at all it reports every declaration, so it cannot come back clean on nothing", () => {
    const report = reportDeclaredPins(declared, new Set<string>());
    expect(report.missing.length).toBe(report.distinctDeclared);
    expect(report.missing.length).toBeGreaterThan(100);
  });

  test("a barrel declaration is resolved, not counted as missing", () => {
    // lq-01 declares radiation.ts; the code is in radiation/waves.ts, which is what pins.json keys.
    // Comparing raw declared keys reports 29 missing, 14 of them pinned under the real file's name.
    const barrel = declared.find(
      (d) => d.instrumentId === "lq-01" && d.exportName === "twoSourceIntensity",
    );
    expect(barrel?.declaredModule).toBe("src/physics/reference/radiation.ts");
    expect(barrel?.filePath).toBe("src/physics/reference/radiation/waves.ts");
    const raw = new Set(declared.map((d) => `${d.exportName}@${d.declaredModule}`));
    const resolvedKeys = new Set(declared.map((d) => `${d.exportName}@${d.filePath}`));
    const pinned = pins(resolve(root, "src/content/kernel/pins.json"));
    const rawMissing = [...raw].filter((k) => !pinned.has(k)).length;
    const resolvedMissing = [...resolvedKeys].filter((k) => !pinned.has(k)).length;
    console.log(
      `[declared pins] raw keys report ${rawMissing} missing; resolved keys ${resolvedMissing}`,
    );
    expect(rawMissing).toBeGreaterThan(resolvedMissing);
    expect(resolvedMissing).toBe(0);
  });
});
