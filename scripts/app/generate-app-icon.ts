/**
 * Draw the app icon and the launch colour from the web theme (App plan §9).
 *
 * The icon is the placeholder site's page-count mark: four bars whose lengths
 * are the printed page counts of the four papers, Ann. Phys. 17, 132–148 (17
 * pages), 17, 549–560 (12), 17, 891–921 (31) and 18, 639–641 (3), the last in
 * the accent colour. Colours come from THEME_TOKENS, so the icon and the launch
 * screen cannot drift from the site: Annalen for the light icon, Kramgasse
 * Night for the dark one. The placeholder's beige ground is not used; the site
 * no longer has it.
 *
 * Writes into ios/AnnusMirabilis/Resources/Assets.xcassets/:
 *   AppIcon.appiconset/AppIcon-light.png, AppIcon-dark.png, Contents.json
 *   LaunchBackground.colorset/Contents.json
 *   AccentColor.colorset/Contents.json (the site's accent, for system controls in the app)
 *   PageInk.colorset/Contents.json (the site's ink, for native controls over the page)
 *   PageMark.imageset/ (the mark at 180 px, for the share sheet's preview)
 *
 * Usage: `bun scripts/app/generate-app-icon.ts`
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";
import { THEME_TOKENS } from "../../src/app/theme/tokens.ts";

export const ICON_SIZE = 1024;

/** Printed pages of light-quanta, brownian-motion, special-relativity, mass-energy. */
export const PAGE_COUNTS = [17, 12, 31, 3] as const;

export type Rgb = readonly [number, number, number];

export type IconPalette = { readonly ground: Rgb; readonly bar: Rgb; readonly last: Rgb };

export function hexToRgb(hex: string): Rgb {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (match === null) {
    return [0, 0, 0];
  }
  return [
    Number.parseInt(match[1] ?? "0", 16),
    Number.parseInt(match[2] ?? "0", 16),
    Number.parseInt(match[3] ?? "0", 16),
  ];
}

export function iconPalettes(): { readonly light: IconPalette; readonly dark: IconPalette } {
  const light = THEME_TOKENS.annalen;
  const dark = THEME_TOKENS["kramgasse-night"];
  return {
    light: {
      ground: hexToRgb(light.paper),
      bar: hexToRgb(light.ink),
      last: hexToRgb(light.accent),
    },
    dark: { ground: hexToRgb(dark.paper), bar: hexToRgb(dark.ink), last: hexToRgb(dark.accent) },
  };
}

export type Bar = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/**
 * The four bars on a square canvas, left-aligned, the 31-page bar spanning the
 * middle 58.6% so the mark sits inside the rounded mask iOS applies.
 */
export function barLayout(size: number): Bar[] {
  const longest = Math.max(...PAGE_COUNTS);
  const span = Math.round(size * 0.586);
  const thickness = Math.round(size * 0.086);
  const gap = Math.round(size * 0.059);
  const total = PAGE_COUNTS.length * thickness + (PAGE_COUNTS.length - 1) * gap;
  const top = Math.round((size - total) / 2);
  const left = Math.round((size - span) / 2);
  return PAGE_COUNTS.map((pages, index) => ({
    x: left,
    y: top + index * (thickness + gap),
    width: Math.round((span * pages) / longest),
    height: thickness,
  }));
}

/** RGB raster, row-major, three bytes per pixel. */
export function rasterize(size: number, palette: IconPalette): Uint8Array {
  const pixels = new Uint8Array(size * size * 3);
  for (let offset = 0; offset < pixels.length; offset += 3) {
    pixels.set(palette.ground, offset);
  }
  const bars = barLayout(size);
  bars.forEach((bar, index) => {
    const colour = index === bars.length - 1 ? palette.last : palette.bar;
    for (let y = bar.y; y < bar.y + bar.height; y++) {
      for (let x = bar.x; x < bar.x + bar.width; x++) {
        pixels.set(colour, (y * size + x) * 3);
      }
    }
  });
  return pixels;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) {
    c = (CRC_TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** An 8-bit RGB PNG, filter 0 on every row. */
export function encodePng(width: number, height: number, rgb: Uint8Array): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const rows = Buffer.alloc(height * (width * 3 + 1));
  for (let y = 0; y < height; y++) {
    rows[y * (width * 3 + 1)] = 0;
    rows.set(rgb.subarray(y * width * 3, (y + 1) * width * 3), y * (width * 3 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows, { level: 9 })),
    chunk("IEND", new Uint8Array()),
  ]);
}

/** Decodes only what encodePng writes (8-bit RGB, filter 0); anything else is null. */
export function decodePng(
  png: Uint8Array,
): { width: number; height: number; rgb: Uint8Array } | null {
  const buffer = Buffer.from(png);
  if (buffer.readUInt32BE(0) !== 0x89504e47) {
    return null;
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  const data: Buffer[] = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const body = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      if (body[8] !== 8 || body[9] !== 2) {
        return null;
      }
    } else if (type === "IDAT") {
      data.push(body);
    }
    offset += 12 + length;
  }
  const rows = inflateSync(Buffer.concat(data));
  const rgb = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    if (rows[y * (width * 3 + 1)] !== 0) {
      return null;
    }
    rgb.set(rows.subarray(y * (width * 3 + 1) + 1, (y + 1) * (width * 3 + 1)), y * width * 3);
  }
  return { width, height, rgb };
}

export const APP_ICON_CONTENTS = {
  images: [
    { filename: "AppIcon-light.png", idiom: "universal", platform: "ios", size: "1024x1024" },
    {
      appearances: [{ appearance: "luminosity", value: "dark" }],
      filename: "AppIcon-dark.png",
      idiom: "universal",
      platform: "ios",
      size: "1024x1024",
    },
  ],
  info: { author: "xcode", version: 1 },
};

function colourComponents(rgb: Rgb) {
  const hex = (value: number) => `0x${value.toString(16).toUpperCase().padStart(2, "0")}`;
  return { alpha: "1.000", blue: hex(rgb[2]), green: hex(rgb[1]), red: hex(rgb[0]) };
}

function colorsetContents(light: Rgb, dark: Rgb) {
  return {
    colors: [
      { color: { "color-space": "srgb", components: colourComponents(light) }, idiom: "universal" },
      {
        appearances: [{ appearance: "luminosity", value: "dark" }],
        color: { "color-space": "srgb", components: colourComponents(dark) },
        idiom: "universal",
      },
    ],
    info: { author: "xcode", version: 1 },
  };
}

export function launchBackgroundContents() {
  const { light, dark } = iconPalettes();
  return colorsetContents(light.ground, dark.ground);
}

/** The site's accent, so the share sheet and print options match the page, not iOS blue. */
export function accentColorContents() {
  const { light, dark } = iconPalettes();
  return colorsetContents(light.last, dark.last);
}

/** The page's ink, for native controls drawn over the page, so they read at the site's own contrast. */
export function pageInkContents() {
  const { light, dark } = iconPalettes();
  return colorsetContents(light.bar, dark.bar);
}

/** The mark for the share sheet's preview: 60 points at 3x. */
export const MARK_SIZE = 180;

export const PAGE_MARK_CONTENTS = {
  images: [
    { filename: "PageMark-light.png", idiom: "universal" },
    {
      appearances: [{ appearance: "luminosity", value: "dark" }],
      filename: "PageMark-dark.png",
      idiom: "universal",
    },
  ],
  info: { author: "xcode", version: 1 },
};

export const ASSET_CATALOG = join("ios", "AnnusMirabilis", "Resources", "Assets.xcassets");

function main(): number {
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const catalog = join(repo, ASSET_CATALOG);
  const { light, dark } = iconPalettes();
  writeFileSync(
    join(catalog, "AppIcon.appiconset", "AppIcon-light.png"),
    encodePng(ICON_SIZE, ICON_SIZE, rasterize(ICON_SIZE, light)),
  );
  writeFileSync(
    join(catalog, "AppIcon.appiconset", "AppIcon-dark.png"),
    encodePng(ICON_SIZE, ICON_SIZE, rasterize(ICON_SIZE, dark)),
  );
  writeFileSync(
    join(catalog, "AppIcon.appiconset", "Contents.json"),
    `${JSON.stringify(APP_ICON_CONTENTS, null, 2)}\n`,
  );
  writeFileSync(
    join(catalog, "LaunchBackground.colorset", "Contents.json"),
    `${JSON.stringify(launchBackgroundContents(), null, 2)}\n`,
  );
  mkdirSync(join(catalog, "PageInk.colorset"), { recursive: true });
  writeFileSync(
    join(catalog, "PageInk.colorset", "Contents.json"),
    `${JSON.stringify(pageInkContents(), null, 2)}\n`,
  );
  mkdirSync(join(catalog, "AccentColor.colorset"), { recursive: true });
  writeFileSync(
    join(catalog, "AccentColor.colorset", "Contents.json"),
    `${JSON.stringify(accentColorContents(), null, 2)}\n`,
  );
  mkdirSync(join(catalog, "PageMark.imageset"), { recursive: true });
  writeFileSync(
    join(catalog, "PageMark.imageset", "PageMark-light.png"),
    encodePng(MARK_SIZE, MARK_SIZE, rasterize(MARK_SIZE, light)),
  );
  writeFileSync(
    join(catalog, "PageMark.imageset", "PageMark-dark.png"),
    encodePng(MARK_SIZE, MARK_SIZE, rasterize(MARK_SIZE, dark)),
  );
  writeFileSync(
    join(catalog, "PageMark.imageset", "Contents.json"),
    `${JSON.stringify(PAGE_MARK_CONTENTS, null, 2)}\n`,
  );
  process.stdout.write(`app icon, colours and page mark written under ${ASSET_CATALOG}\n`);
  return 0;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
