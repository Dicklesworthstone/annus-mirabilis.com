import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { strictParse } from "../content/schemas/strictParse.ts";
import { BM01_DEFAULTS } from "../experiments/bm01/definition.ts";
import { validateBm01Parameters } from "../experiments/bm01/parameters.ts";
import { createBm01Session, type PreparedBm01Example } from "../experiments/bm01/session.ts";
import {
  type DeclaredDomain,
  declaredDomains,
  domainRequirement,
  rangeText,
} from "../experiments/controls/declaredDomain.ts";
import bm01Example from "../generated/bm01-example.json";

/**
 * A laboratory refuses a setting outside the modelDomain its manifest declares (dispatch 134).
 *
 * BM-01 accepted T = 1e300 K beside content/experiments/bm-01.yaml's 273-330 K ("Liquid state of
 * water at ordinary laboratory pressure"), and one of its curves stopped drawing without a word.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

describe("the declared-domain table is the manifests", () => {
  test("every numeric modelDomain in content/experiments appears with its bounds and reason", () => {
    let checked = 0;
    for (const file of readdirSync(resolve(root, "content/experiments")).filter((f) =>
      f.endsWith(".yaml"),
    )) {
      const lab = file.slice(0, -5);
      const manifest = strictParse(
        readFileSync(resolve(root, "content/experiments", file), "utf8"),
        "yaml",
      ) as { parameters?: { id: string; modelDomain?: { min?: unknown; max?: unknown } }[] };
      for (const p of manifest.parameters ?? []) {
        const d = p.modelDomain;
        if (!d || (typeof d.min !== "number" && typeof d.max !== "number")) continue;
        const declared = declaredDomains(lab)[p.id];
        expect(declared, `${lab}.${p.id}`).toBeDefined();
        expect(declared?.min).toBe(d.min as number | undefined);
        expect(declared?.max).toBe(d.max as number | undefined);
        checked += 1;
      }
    }
    // Non-vacuity: the manifests do declare numeric domains.
    expect(checked).toBeGreaterThan(0);
    expect(declaredDomains("bm-01").T?.reason).toBe(
      "Liquid state of water at ordinary laboratory pressure",
    );
  });
});

describe("the refusal sentence", () => {
  const closed: DeclaredDomain = {
    label: "Temperature",
    displayUnit: "K",
    min: 273,
    max: 330,
    reason: "Liquid state of water at ordinary laboratory pressure",
  };

  test("names the range in the page's units and the manifest's reason", () => {
    expect(domainRequirement(closed)).toBe(
      "Temperature must be from 273 to 330 K in this model: liquid state of water at ordinary laboratory pressure.",
    );
    // A stored value in Pa·s, typed in mPa·s.
    expect(
      rangeText(
        { label: "Viscosity", displayUnit: "mPa s", min: 0.0005, max: 0.02, reason: "" },
        { scale: 1000 },
      ),
    ).toBe("from 0.5 to 20 mPa·s");
  });

  test("says which ends are open, and writes powers of ten as a reader does", () => {
    expect(
      rangeText({
        label: "L",
        displayUnit: "J",
        min: 0,
        minInclusive: false,
        max: 1e22,
        reason: "",
      }),
    ).toBe("greater than 0 and at most 1 × 10²² J");
    expect(rangeText({ label: "x", displayUnit: "1", min: 1, reason: "" })).toBe("at least 1");
    expect(rangeText({ label: "a", displayUnit: "deg", max: 360, reason: "" })).toBe(
      "at most 360°",
    );
  });

  test("keeps a name's capital after the colon and lowers an ordinary word's", () => {
    expect(
      domainRequirement({ ...closed, reason: "Newtonian-liquid Stokes drag regime" }),
    ).toContain("in this model: Newtonian-liquid Stokes drag regime.");
    expect(domainRequirement({ ...closed, reason: "A probability" })).toContain(
      "in this model: a probability.",
    );
  });
});

describe("BM-01 enforces its declared domain", () => {
  const refusedFor = (key: keyof typeof BM01_DEFAULTS, value: number) => {
    const r = validateBm01Parameters({ ...BM01_DEFAULTS, [key]: value });
    return r.kind === "refused" ? r.refusal : undefined;
  };

  test("1e300 K is refused as outside the model, naming 273-330 K and the reason", () => {
    const refusal = refusedFor("T", 1e300);
    expect(refusal?.code).toBe("outside-model-domain");
    expect(refusal?.domainKind).toBe("model");
    expect(refusal?.details?.requirements).toBe(
      "Temperature must be from 273 to 330 K in this model: liquid state of water at ordinary laboratory pressure.",
    );
  });

  test("the bounds themselves are inside, and a step past either end is not", () => {
    expect(refusedFor("T", 273)).toBeUndefined();
    expect(refusedFor("T", 330)).toBeUndefined();
    expect(refusedFor("T", 272.99)?.code).toBe("outside-model-domain");
    expect(refusedFor("T", 330.01)?.code).toBe("outside-model-domain");
  });

  test("each declared control speaks in the unit it is typed in", () => {
    expect(refusedFor("eta", 0.05)?.details?.requirements).toContain("from 0.5 to 20 mPa·s");
    expect(refusedFor("a", 1e-8)?.details?.requirements).toContain("from 0.1 to 5 μm");
    expect(refusedFor("M", 5000)?.details?.requirements).toContain(
      "Number of tracers must be from 1 to 3000 in this model",
    );
  });

  test("a refused request leaves the last accepted trial in place", () => {
    const session = createBm01Session("declared-domain", bm01Example as PreparedBm01Example, () => {
      throw new TypeError("a refused request must not start a worker");
    });
    const before = session.getSnapshot();
    const r = session.apply({ ...BM01_DEFAULTS, T: 1e300 });
    expect(r?.kind).toBe("refused");
    expect(session.getSnapshot()).toBe(before);
    expect(before.accepted?.parameters?.T).toBe(bm01Example.parameters.T);
  });
});
