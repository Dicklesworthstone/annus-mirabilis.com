/**
 * The committed app icon and launch colour are what the generator draws from
 * the current web theme. A theme change that is not regenerated fails here, by
 * pixels rather than bytes, so the check does not depend on one zlib build.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { THEME_TOKENS } from "../../src/app/theme/tokens.ts";
import {
  APP_ICON_CONTENTS,
  ASSET_CATALOG,
  accentColorContents,
  barLayout,
  decodePng,
  encodePng,
  hexToRgb,
  ICON_SIZE,
  iconPalettes,
  launchBackgroundContents,
  MARK_SIZE,
  mutedInkContents,
  PAGE_COUNTS,
  PAGE_MARK_CONTENTS,
  pageInkContents,
  rasterize,
} from "./generate-app-icon.ts";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CATALOG = join(REPO, ASSET_CATALOG);

function firstDifference(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length) {
    return -2;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return i;
    }
  }
  return -1;
}

describe("app icon", () => {
  const palettes = iconPalettes();

  for (const variant of ["light", "dark"] as const) {
    it(`the committed ${variant} icon is the generator's drawing, pixel for pixel`, () => {
      const committed = decodePng(
        readFileSync(join(CATALOG, "AppIcon.appiconset", `AppIcon-${variant}.png`)),
      );
      assert.ok(
        committed !== null,
        "the committed icon is not an 8-bit RGB PNG the generator wrote",
      );
      assert.equal(committed.width, ICON_SIZE);
      assert.equal(committed.height, ICON_SIZE);
      const at = firstDifference(committed.rgb, rasterize(ICON_SIZE, palettes[variant]));
      assert.equal(
        at,
        -1,
        `pixel ${Math.floor(at / 3)} differs; run bun scripts/app/generate-app-icon.ts`,
      );
    });
  }

  it("takes its colours from the web theme, never from a copy", () => {
    assert.deepEqual(palettes.light.ground, hexToRgb(THEME_TOKENS.annalen.paper));
    assert.deepEqual(palettes.light.last, hexToRgb(THEME_TOKENS.annalen.accent));
    assert.deepEqual(palettes.dark.ground, hexToRgb(THEME_TOKENS["kramgasse-night"].paper));
    assert.deepEqual(palettes.dark.bar, hexToRgb(THEME_TOKENS["kramgasse-night"].ink));
  });

  it("draws bars whose lengths are the papers' printed page counts", () => {
    const bars = barLayout(ICON_SIZE);
    assert.equal(bars.length, PAGE_COUNTS.length);
    const unit = (bars[2]?.width ?? 0) / 31;
    PAGE_COUNTS.forEach((pages, index) => {
      assert.ok(
        Math.abs((bars[index]?.width ?? 0) - pages * unit) <= 0.5,
        `bar ${index} is not ${pages} pages long`,
      );
    });
    assert.ok(
      bars.every((bar) => bar.x === bars[0]?.x),
      "the bars share a left edge",
    );
  });

  it("keeps the mark inside the middle of the canvas, clear of the rounded mask", () => {
    for (const bar of barLayout(ICON_SIZE)) {
      assert.ok(
        bar.x >= ICON_SIZE * 0.18 && bar.x + bar.width <= ICON_SIZE * 0.82,
        JSON.stringify(bar),
      );
      assert.ok(
        bar.y >= ICON_SIZE * 0.18 && bar.y + bar.height <= ICON_SIZE * 0.82,
        JSON.stringify(bar),
      );
    }
  });

  it("colours only the last bar, the three-page mass-energy paper, with the accent", () => {
    const pixels = rasterize(ICON_SIZE, palettes.light);
    const colourAt = (bar: { x: number; y: number }) => [
      ...pixels.subarray((bar.y * ICON_SIZE + bar.x) * 3, (bar.y * ICON_SIZE + bar.x) * 3 + 3),
    ];
    const bars = barLayout(ICON_SIZE);
    assert.deepEqual(colourAt(bars[3] ?? { x: 0, y: 0 }), [...palettes.light.last]);
    for (const bar of bars.slice(0, 3)) {
      assert.deepEqual(colourAt(bar), [...palettes.light.bar]);
    }
  });

  it("commits the asset catalog entries the generator writes", () => {
    const icon = JSON.parse(
      readFileSync(join(CATALOG, "AppIcon.appiconset", "Contents.json"), "utf8"),
    );
    assert.deepEqual(icon, APP_ICON_CONTENTS);
    const launch = JSON.parse(
      readFileSync(join(CATALOG, "LaunchBackground.colorset", "Contents.json"), "utf8"),
    );
    assert.deepEqual(launch, launchBackgroundContents());
    const accent = JSON.parse(
      readFileSync(join(CATALOG, "AccentColor.colorset", "Contents.json"), "utf8"),
    );
    assert.deepEqual(accent, accentColorContents());
    const ink = JSON.parse(
      readFileSync(join(CATALOG, "PageInk.colorset", "Contents.json"), "utf8"),
    );
    assert.deepEqual(ink, pageInkContents());
    const muted = JSON.parse(
      readFileSync(join(CATALOG, "MutedInk.colorset", "Contents.json"), "utf8"),
    );
    assert.deepEqual(muted, mutedInkContents());
    const mark = JSON.parse(
      readFileSync(join(CATALOG, "PageMark.imageset", "Contents.json"), "utf8"),
    );
    assert.deepEqual(mark, PAGE_MARK_CONTENTS);
  });

  for (const variant of ["light", "dark"] as const) {
    it(`the committed ${variant} share-preview mark is the same drawing at ${MARK_SIZE} px`, () => {
      const committed = decodePng(
        readFileSync(join(CATALOG, "PageMark.imageset", `PageMark-${variant}.png`)),
      );
      assert.ok(committed !== null);
      assert.equal(committed.width, MARK_SIZE);
      assert.equal(firstDifference(committed.rgb, rasterize(MARK_SIZE, palettes[variant])), -1);
    });
  }
});

describe("PNG encoding", () => {
  it("round-trips a raster", () => {
    const rgb = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const decoded = decodePng(encodePng(2, 2, rgb));
    assert.ok(decoded !== null);
    assert.deepEqual([...decoded.rgb], [...rgb]);
  });

  it("refuses bytes that are not a PNG", () => {
    assert.equal(decodePng(new Uint8Array(16)), null);
  });
});

describe("the muted ink for secondary text in native lists", () => {
  const luminance = (hex: string) => {
    const channel = (at: number) => {
      const value = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  };
  const contrast = (a: string, b: string) => {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05);
  };
  // iOS list backgrounds: cell and grouped ground, light then dark (UIColor.systemBackground,
  // secondarySystemGroupedBackground, systemGroupedBackground, tertiarySystemGroupedBackground).
  const grounds = {
    annalen: ["#ffffff", "#f2f2f7"],
    "kramgasse-night": ["#000000", "#1c1c1e", "#2c2c2e"],
  } as const;

  it("clears 4.5:1 on every list background in both themes", () => {
    for (const theme of ["annalen", "kramgasse-night"] as const) {
      for (const ground of grounds[theme]) {
        const ratio = contrast(THEME_TOKENS[theme].muted, ground);
        assert.ok(ratio >= 4.5, `${theme} muted on ${ground}: ${ratio.toFixed(2)}`);
      }
    }
  });

  it("is a test that can fail: iOS's own secondary label on white does not clear it", () => {
    // secondaryLabel is #3c3c43 at 60 percent, which composites on white to #8a8a8e.
    assert.ok(contrast("#8a8a8e", "#ffffff") < 4.5);
  });
});
