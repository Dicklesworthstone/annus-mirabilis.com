import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { renderToStaticMarkup } from "react-dom/server";
import { MagnitudeScale } from "../components/foundations/MagnitudeScale.tsx";
import {
  compare,
  enclosingDecades,
  MAGNITUDE_FAMILIES,
  type MagnitudeFamily,
  type MagnitudeItem,
  positionOnScale,
} from "../foundations/magnitudes.ts";
import { withinTolerance } from "../units/tolerance.ts";

/**
 * The log scale of foundation:orders-of-magnitude (am-found-quantities-magnitudes-igxe). Its
 * numbers are the lesson's, its axis is logarithmic, and it compares two numbers as a ratio and
 * a count of powers of ten.
 */

const close = (actual: number, reference: number, relative = 1e-9) =>
  expect(withinTolerance(actual, reference, { relative }).ok).toBe(true);

const setValue = (setId: string, quantityId: string): number => {
  const entries = (
    load(
      readFileSync(
        new URL(`../../content/quantities/constant-sets/${setId}.yaml`, import.meta.url),
        "utf8",
      ),
    ) as { entries: { quantityId: string; value: number }[] }
  ).entries;
  const found = entries.find((e) => e.quantityId === quantityId);
  expect(found).toBeDefined();
  return found?.value ?? Number.NaN;
};

const family = (id: MagnitudeFamily["id"]): MagnitudeFamily => {
  const found = MAGNITUDE_FAMILIES.find((f) => f.id === id);
  expect(found).toBeDefined();
  return found as MagnitudeFamily;
};

const item = (familyId: MagnitudeFamily["id"], id: string): MagnitudeItem => {
  const found = family(familyId).items.find((i) => i.id === id);
  expect(found).toBeDefined();
  return found as MagnitudeItem;
};

describe("the numbers are the lesson's", () => {
  test("speeds are v/c with the modern exact c", () => {
    const c = setValue("modern-si-2019", "speedOfLight");
    close(item("speeds", "bullet").value, 1000 / c);
    close(item("speeds", "jet").value, 250 / c);
    close(item("speeds", "earth").value, 29_800 / c);
    close(item("speeds", "earth-squared").value, (29_800 / c) ** 2);
  });

  test("the paper's spread is the constant set's, and √60 times it in a minute is about 6 μm", () => {
    const set = setValue("einstein-1905-brownian-printed", "rmsDisplacement1d");
    close(item("sizes", "spread-second").value, Number(set.toPrecision(4)));
    close(item("sizes", "spread-minute").value, 6.157e-6, 1e-3);
  });
});

describe("a logarithmic axis", () => {
  test("each family's whole range runs between the powers of ten that enclose it", () => {
    expect(enclosingDecades(family("sizes").items.map((i) => i.value))).toEqual({
      low: -10,
      high: -5,
    });
    expect(enclosingDecades(family("speeds").items.map((i) => i.value))).toEqual({
      low: -9,
      high: -4,
    });
  });

  test("a value sits at its power of ten: 10⁻⁶ m is four fifths of the way along 10⁻¹⁰ to 10⁻⁵", () => {
    const range = { low: -10, high: -5 };
    close(positionOnScale(1e-6, range) ?? Number.NaN, 0.8);
    // A relative tolerance cannot judge a true zero, and log10(10⁻¹⁰) is exactly −10.
    expect(positionOnScale(1e-10, range)).toBe(0);
    expect(positionOnScale(1e-11, range)).toBeNull();
    expect(positionOnScale(0, range)).toBeNull();
    expect(positionOnScale(-1, range)).toBeNull();
  });

  test("adversarial: on this axis the molecule and ultraviolet sit far apart, as they would not on a linear one", () => {
    // On a linear axis from 0 to 10⁻⁵ m both would be within 3 percent of the left end.
    const range = enclosingDecades(family("sizes").items.map((i) => i.value));
    const molecule = positionOnScale(item("sizes", "water-molecule").value, range) ?? 0;
    const ultraviolet = positionOnScale(item("sizes", "ultraviolet").value, range) ?? 0;
    expect(ultraviolet - molecule).toBeGreaterThan(0.5);
  });

  test("zooming to a pair encloses just that pair, at least one power wide", () => {
    const pair = [item("sizes", "red").value, item("sizes", "grain").value];
    expect(enclosingDecades(pair)).toEqual({ low: -7, high: -6 });
    expect(enclosingDecades([1e-6, 1e-6])).toEqual({ low: -6, high: -5 });
  });
});

describe("comparing two numbers", () => {
  test("a grain is about 3,300 times a water molecule, 3.5 powers of ten, in either order", () => {
    const molecule = item("sizes", "water-molecule");
    const grain = item("sizes", "grain");
    for (const cmp of [compare(molecule, grain), compare(grain, molecule)]) {
      expect(cmp.larger.id).toBe("grain");
      close(cmp.ratio, 1e-6 / 0.3e-9);
      close(cmp.powers, Math.log10(1e-6 / 0.3e-9));
    }
  });
});

describe("the construction as served", () => {
  const html = renderToStaticMarkup(<MagnitudeScale />);
  const text = html.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'");

  test("its first render, before any script runs, compares the grain with the molecule", () => {
    expect(html).toContain('data-foundation-construction="orders-of-magnitude"');
    expect(text).toContain(
      "The width of a Brownian grain is 3,300 times the width of a water molecule: 3.5 powers of ten apart.",
    );
  });

  test("every size is listed with its value, and each row is its own line", () => {
    expect((html.match(/class="magnitude-track"/g) ?? []).length).toBe(
      family("sizes").items.length,
    );
    for (const i of family("sizes").items) expect(text).toContain(i.label);
  });

  test("it says Kaufmann's electrons are left off, and why", () => {
    expect(text).toContain("Kaufmann's fast electrons are not placed here");
  });
});
