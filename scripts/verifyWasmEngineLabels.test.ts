import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertDeclaredEngine,
  engineTally,
  runWasmVerification,
  UndeclaredEngineClaimError,
  type VerificationCheckResult,
  type WasmCheckEngine,
} from "./verify-wasm-artifacts.ts";

/**
 * EVERY CHECK SAYS WHAT PRODUCED THE NUMBER IT JUDGED (am-verify-wasm-reports-js-as-wasm-oncl).
 *
 * The bead was filed on 2026-09-24, when the deployed artifact was a 154-byte placeholder whose
 * companion JS reimplemented Philox, `brownian_frames` and `diffusion1d_frames`. Its Brownian and
 * diffusion checks therefore passed against a JavaScript reimplementation while reading, to anyone
 * citing them, as evidence about WASM.
 *
 * THAT PREMISE IS STALE AND THE DEFECT IS NOT. A real 92,751-byte module has been pinned since
 * 2026-09-26, so the checks do call a compiled module today. What the bead asks for beyond that is
 * acceptance item 3, "the output lists, per check, the engine and what was examined", and before
 * this change the word "engine" appeared ZERO times in the script's 42 KB: a reader deduced the
 * engine from prose like "the compiled module exports" or "the TS port's". An inference is not a
 * label, and a label is the only thing that survives the artifact changing underneath it.
 *
 * So this file asserts the property that makes the original finding impossible to repeat: a run
 * cannot report a WASM result that no WASM produced, and cannot quietly promote a check's claim.
 */
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = join(REPO, "public/wasm/manifest.json");

/** The engines that constitute evidence about WASM. */
const WASM_ENGINES: readonly WasmCheckEngine[] = ["wasm-export", "wasm-vs-ts"];
const wasmCount = (checks: readonly VerificationCheckResult[]) =>
  engineTally(checks)
    .filter(([e]) => WASM_ENGINES.includes(e))
    .reduce((a, [, n]) => a + n, 0);

describe("verify-wasm-artifacts labels the engine of every check", () => {
  test("against the pinned artifact: every check carries an engine, and the WASM ones are exercised", async () => {
    const result = await runWasmVerification({ repoRoot: REPO });
    // The denominator first. A run that assembled two checks would satisfy every assertion below
    // while establishing nothing, which is the shape AGENTS.md calls a failed citation.
    expect(result.checks.length).toBeGreaterThanOrEqual(12);
    const unlabelled = result.checks.filter((c) => !c.engine);
    expect(unlabelled.map((c) => c.testId)).toEqual([]);
    console.log(
      `[census] engine labels examined ${result.checks.length} wasm verification check(s); ` +
        `${engineTally(result.checks)
          .map(([e, n]) => `${e} ${n}`)
          .join(", ")}`,
    );
    // Not a count: the exact distribution, so a check that is relabelled into a stronger or weaker
    // claim fails here by name rather than being absorbed into a total.
    expect(Object.fromEntries(result.checks.map((c) => [c.testId, c.engine]))).toEqual({
      "manifest-digests-and-validation": "artifact-bytes",
      "module-instantiation": "wasm-export",
      "capability-matrix-agreement": "declarations",
      "export-validity-small-cases": "wasm-export",
      "philox-normals-kats-and-suffix": "wasm-vs-ts",
      "philox-normals-wasm-vs-ts-port": "wasm-vs-ts",
      "brownian-trajectories-and-kernel-resolution": "wasm-export",
      "ftcs-1d-stability-boundary": "wasm-export",
      "malformed-output-rejection": "host-decoder",
      "u64-boundaries-round-trip": "wasm-export",
      "wasm-size-budget": "artifact-bytes",
      "provenance-registry-admission": "host-registry",
    });
    expect(wasmCount(result.checks)).toBe(7);
  }, 120_000);

  /**
   * THE BEAD'S OWN PLANT, in the only form the current tree allows.
   *
   * It asks to "rename the export so the JS path answers; the WASM claim must not pass". There is no
   * JS path to answer any more -- the placeholder's companion reimplementation is not what the
   * manifest names -- so the equivalent is to point the script at a manifest whose bundle is not
   * there and assert that no WASM claim survives. It is done through `manifestPath`, which the
   * script already accepts, rather than by moving the pinned artifact: RULE 1 governs that file, and
   * a test that has to move a generated artifact to run is a test nobody runs.
   */
  test("PLANTED: with the bundle absent, every WASM claim reports not-exercised and nothing claims WASM", async () => {
    const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as Record<string, unknown>;
    const dir = mkdtempSync(join(tmpdir(), "am-wasm-engine-"));
    const planted = join(dir, "manifest.json");
    writeFileSync(
      planted,
      JSON.stringify({ ...manifest, bundleDir: "public/wasm/does-not-exist/0000000000000000" }),
      "utf8",
    );

    const result = await runWasmVerification({ repoRoot: REPO, manifestPath: planted });

    // The population is unchanged: the six export checks are still PUSHED, as "Not run: the module
    // did not load". A run that simply dropped them would print a smaller, all-green summary.
    expect(result.checks.length).toBeGreaterThanOrEqual(12);
    expect(wasmCount(result.checks)).toBe(0);
    const exportChecks = [
      "export-validity-small-cases",
      "philox-normals-kats-and-suffix",
      "philox-normals-wasm-vs-ts-port",
      "brownian-trajectories-and-kernel-resolution",
      "ftcs-1d-stability-boundary",
      "malformed-output-rejection",
      "u64-boundaries-round-trip",
    ];
    for (const testId of exportChecks) {
      const c = result.checks.find((x) => x.testId === testId);
      expect(c?.engine).toBe("not-exercised");
    }
    // And it FAILS, which is stricter than the bead's acceptance item 1 asked for ("still passes the
    // JS checks"). A run that cannot reach the module is not a pass with a caveat.
    expect(result.passed).toBe(false);
  }, 120_000);

  /**
   * A CHECK CANNOT PROMOTE ITS OWN CLAIM. Without this, the engine field would be decoration: a
   * future edit could relabel `malformed-output-rejection` from `host-decoder` to `wasm-export` and
   * the summary would report seven WASM checks where six ran.
   */
  test("a stronger engine claim than the declared one is refused, with the code first", () => {
    const honest: VerificationCheckResult = {
      testId: "malformed-output-rejection",
      engine: "host-decoder",
      passed: true,
      comparisonKind: "structural",
      message: "the real one",
    };
    expect(() => assertDeclaredEngine([honest])).not.toThrow();
    // Downgrading to not-exercised is always allowed: it claims less, never more.
    expect(() => assertDeclaredEngine([{ ...honest, engine: "not-exercised" }])).not.toThrow();

    let thrown: unknown;
    try {
      assertDeclaredEngine([{ ...honest, engine: "wasm-export" }]);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(UndeclaredEngineClaimError);
    // The CODE, which is the first constructor argument so the refusal ratchet can credit it, and
    // not a substring of the message: the bare-throw ratchet read this class as an untyped throw
    // while the code lived in the sentence.
    expect((thrown as UndeclaredEngineClaimError).code).toBe("undeclared-engine-claim");
    expect((thrown as Error).message).toContain('reports engine "wasm-export"');

    // A check nobody declared cannot report an engine at all, so a new check arrives with its claim
    // written down beside the other twelve rather than asserting one in passing.
    expect(() =>
      assertDeclaredEngine([{ ...honest, testId: "a-check-added-later", engine: "wasm-export" }]),
    ).toThrow(UndeclaredEngineClaimError);
  });
});
