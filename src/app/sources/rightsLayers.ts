import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SourcesError } from "./refusals.ts";

/*
 * WHOSE RIGHTS, LAYER BY LAYER (am-design-sources-about-zumd). /sources/ states each rights layer's
 * own status: the German text, the scans, the translation, the explanations, the code, FrankenSim's
 * artifacts, the fonts, the libraries, the figures and the datasets. Every statement is read from a
 * record at build time, never typed here: NOTICE.md for the layers, the provenance receipts for the
 * scans, package.json and each package's own manifest for the libraries, and docs/DECISIONS.md for
 * the status of the license decision. A layer NOTICE.md does not state stops the build, so the page
 * cannot quietly drop one.
 */

export const REPOSITORY = "https://github.com/Dicklesworthstone/annus-mirabilis.com";

export type NoticeBullet = Readonly<{ key?: string; text: string }>;
export type NoticeSection = Readonly<{
  heading: string;
  paragraphs: readonly string[];
  bullets: readonly NoticeBullet[];
}>;

/** Markdown emphasis and code marks removed, so a record's words read as words. */
function plain(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Each "## " section of NOTICE.md: its paragraphs and bullets, up to its first "### ". */
export function noticeSections(notice: string): NoticeSection[] {
  const sections: NoticeSection[] = [];
  for (const part of notice.split(/^## /m).slice(1)) {
    const [headLine = "", ...rest] = part.split("\n");
    const body = (rest.join("\n").split(/^### /m)[0] ?? "").replace(/```[\s\S]*?```/g, "");
    const paragraphs: string[] = [];
    const bullets: NoticeBullet[] = [];
    let paragraph: string[] = [];
    const flush = () => {
      if (paragraph.length > 0) paragraphs.push(plain(paragraph.join(" ")));
      paragraph = [];
    };
    for (const line of body.split("\n")) {
      const bullet = /^- (.*)$/.exec(line);
      if (bullet) {
        flush();
        const keyed = /^\*\*([^*:]+):\*\*\s*(.*)$/.exec(bullet[1] ?? "");
        bullets.push(
          keyed
            ? { key: (keyed[1] ?? "").trim(), text: plain(keyed[2] ?? "") }
            : { text: plain(bullet[1] ?? "") },
        );
      } else if (line.trim() === "" || /^---\s*$/.test(line)) {
        flush();
      } else {
        paragraph.push(line.trim());
      }
    }
    flush();
    sections.push({ heading: headLine.trim(), paragraphs, bullets });
  }
  return sections;
}

/** How a layer's statement is read from its NOTICE.md section. */
type LayerSpec = Readonly<{
  id: string;
  heading: string;
  name: string;
  /** "lead": the section's first paragraph. "keys": the bullets with these keys. "bullets": all. */
  read: "lead" | "bullets" | readonly string[];
}>;

const LAYERS: readonly LayerSpec[] = [
  {
    id: "german-text",
    heading: "Historical German text",
    name: "Einstein's German text",
    read: "lead",
  },
  { id: "scans", heading: "Facsimile scans", name: "The scans", read: "lead" },
  {
    id: "translation",
    heading: "English translation",
    name: "The English translation",
    read: ["License", "Copyright"],
  },
  {
    id: "prose",
    heading: "Explanatory prose",
    name: "The explanations",
    read: ["License", "Copyright"],
  },
  { id: "code", heading: "Code", name: "The code", read: ["License", "Copyright"] },
  {
    id: "frankensim",
    heading: "FrankenSim artifacts",
    name: "FrankenSim's compiled physics",
    read: ["License", "Copyright"],
  },
  { id: "fonts", heading: "Fonts", name: "The fonts", read: "bullets" },
  {
    id: "libraries",
    heading: "Third-party runtime libraries",
    name: "The libraries the site runs on",
    read: [],
  },
  {
    id: "figures",
    heading: "Images and figures",
    name: "Figures and photographs",
    read: "bullets",
  },
  { id: "datasets", heading: "Historical datasets", name: "Historical datasets", read: "lead" },
];

export type RightsLayer = Readonly<{ id: string; name: string; statements: readonly string[] }>;

/** The layers in NOTICE.md's order, each with the statements its section records. */
export function rightsLayers(notice: string): RightsLayer[] {
  const sections = noticeSections(notice);
  return LAYERS.map((spec) => {
    const section = sections.find((s) => s.heading === spec.heading);
    if (!section) {
      throw new SourcesError(
        "notice-layer-missing",
        `NOTICE.md has no "## ${spec.heading}" section, so /sources/ cannot state that layer.`,
      );
    }
    const statements =
      spec.read === "lead"
        ? section.paragraphs.slice(0, 1)
        : spec.read === "bullets"
          ? section.bullets.map((b) => (b.key ? `${b.key}: ${b.text}` : b.text))
          : section.bullets
              .filter((b) => b.key !== undefined && spec.read.includes(b.key))
              .map((b) => `${b.key}: ${b.text}`);
    return { id: spec.id, name: spec.name, statements };
  });
}

export type RuntimeLibrary = Readonly<{ name: string; license: string | undefined }>;

/**
 * The libraries the site ships, from package.json's `dependencies`, each with the license its own
 * package.json declares. Development tools are not shipped to a reader, so they are not listed here;
 * THIRD_PARTY_NOTICES.md covers them.
 */
export function runtimeLibraries(root: string): RuntimeLibrary[] {
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
  };
  return Object.keys(manifest.dependencies ?? {})
    .sort()
    .map((name) => {
      const own = join(root, "node_modules", name, "package.json");
      const license = existsSync(own)
        ? ((JSON.parse(readFileSync(own, "utf8")) as { license?: unknown }).license as
            | string
            | undefined)
        : undefined;
      return { name, license: typeof license === "string" ? license : undefined };
    });
}

export type LicenseDecision = Readonly<{ date: string; ownerRatified: boolean }>;

/**
 * The status of the license decision, from its entry in docs/DECISIONS.md: the date it was taken,
 * and whether the owner ratified it. The entry says "**not** owner-ratified" while he has not.
 */
export function licenseDecision(decisions: string): LicenseDecision {
  const start = decisions.indexOf("## D-2026-09-16-license-and-rider");
  const end = start === -1 ? -1 : decisions.indexOf("\n## ", start + 1);
  const entry = start === -1 ? "" : decisions.slice(start, end === -1 ? undefined : end);
  const date = /\*\*Date:\*\*\s*(\d{4}-\d{2}-\d{2})/.exec(entry)?.[1];
  const status = /\*\*Status:\*\*([^\n]*)/.exec(entry)?.[1];
  if (!date || status === undefined) {
    throw new SourcesError(
      "license-decision-missing",
      "docs/DECISIONS.md has no dated D-2026-09-16-license-and-rider entry with a status.",
    );
  }
  const ownerRatified = !/\bnot\b\**\s*owner-ratified/i.test(status);
  return { date, ownerRatified };
}
