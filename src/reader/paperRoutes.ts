/**
 * Paper, section, and face-fallback routing for the reader shell
 * (am-read-shell-routes-3ua). Pure URL and identity rules live here so the
 * App Router pages do not special-case brownian-motion. Compiled papers come
 * from the content index; a paper without a payload is not a route.
 */
import type { Metadata } from "next";
import { PAPER_SLUGS } from "../content/schemas/source.ts";
import { contentIndex, loadPaper } from "../content/server.ts";
import { DEFAULT_FACE, FACE_REGISTRY, type FaceId } from "./faces/registry.ts";

export const SITE_ORIGIN = "https://annus-mirabilis.com";

/** Static no-JavaScript fallback pages. `reading` is the paper/section route itself. */
export const FACE_FALLBACK_IDS = [
  "german",
  "english",
  "gloss",
  "parallel",
  "results",
  "facsimile",
  "split",
] as const;

export type FaceFallbackId = (typeof FACE_FALLBACK_IDS)[number];

export type PaperRouteErrorCode =
  | "unknown-paper"
  | "unknown-section"
  | "unknown-face"
  | "bibliographic-key";

export type PaperRouteRequest = Readonly<{
  paperId: string;
  section?: string;
  face?: string;
}>;

export type PaperRouteOk = Readonly<{
  ok: true;
  paperId: string;
  section: string | undefined;
  face: FaceId;
}>;

export type PaperRouteErr = Readonly<{
  ok: false;
  code: PaperRouteErrorCode;
}>;

export type PaperRouteResult = PaperRouteOk | PaperRouteErr;

const BIBLIOGRAPHIC_KEY = /^ap-\d+-\d+$/;

export function isFaceFallbackId(value: unknown): value is FaceFallbackId {
  return typeof value === "string" && (FACE_FALLBACK_IDS as readonly string[]).includes(value);
}

export function classifyPaperParam(raw: string): "slug" | "bibliographic-key" | "invalid" {
  if (BIBLIOGRAPHIC_KEY.test(raw)) return "bibliographic-key";
  if ((PAPER_SLUGS as readonly string[]).includes(raw)) return "slug";
  return "invalid";
}

export function paperPath(paperId: string, section?: string): string {
  return section === undefined ? `/papers/${paperId}/` : `/papers/${paperId}/${section}/`;
}

export function faceFallbackPath(paperId: string, face: FaceFallbackId, section?: string): string {
  return `${paperPath(paperId, section)}view/${face}/`;
}

export function faceLinkHref(paperId: string, face: FaceId, section?: string): string {
  if (face === DEFAULT_FACE) return paperPath(paperId, section);
  if (isFaceFallbackId(face)) return faceFallbackPath(paperId, face, section);
  return paperPath(paperId, section);
}

export function absoluteUrl(path: string): string {
  return `${SITE_ORIGIN}${path}`;
}

export async function listReadablePapers(): Promise<readonly string[]> {
  const index = await contentIndex();
  return index.payloads
    .filter((entry) => entry.kind === "paper")
    .map((entry) => entry.id)
    .sort();
}

export async function resolvePaperRoute(request: PaperRouteRequest): Promise<PaperRouteResult> {
  const kind = classifyPaperParam(request.paperId);
  if (kind === "bibliographic-key") return { ok: false, code: "bibliographic-key" };
  if (kind === "invalid") return { ok: false, code: "unknown-paper" };

  const readable = await listReadablePapers();
  if (!readable.includes(request.paperId)) return { ok: false, code: "unknown-paper" };

  let section: string | undefined;
  if (request.section !== undefined) {
    const payload = await loadPaper(request.paperId);
    if (!payload.paper.sections.some((s) => s.id === request.section)) {
      return { ok: false, code: "unknown-section" };
    }
    section = request.section;
  }

  if (request.face === undefined) {
    return { ok: true, paperId: request.paperId, section, face: DEFAULT_FACE };
  }
  if (!isFaceFallbackId(request.face)) {
    return { ok: false, code: "unknown-face" };
  }
  return { ok: true, paperId: request.paperId, section, face: request.face };
}

export async function paperStaticParams(): Promise<readonly { paper: string }[]> {
  return (await listReadablePapers()).map((paper) => ({ paper }));
}

export async function sectionStaticParams(): Promise<
  readonly { paper: string; section: string }[]
> {
  const papers = await listReadablePapers();
  const out: { paper: string; section: string }[] = [];
  for (const paper of papers) {
    const payload = await loadPaper(paper);
    for (const section of payload.paper.sections) {
      out.push({ paper, section: section.id });
    }
  }
  return out;
}

export async function faceFallbackStaticParams(): Promise<
  readonly { paper: string; face: string }[]
> {
  const papers = await listReadablePapers();
  return papers.flatMap((paper) => FACE_FALLBACK_IDS.map((face) => ({ paper, face })));
}

export async function sectionFaceFallbackStaticParams(): Promise<
  readonly { paper: string; section: string; face: string }[]
> {
  const sections = await sectionStaticParams();
  return sections.flatMap((row) => FACE_FALLBACK_IDS.map((face) => ({ ...row, face })));
}

export async function paperMetadata(request: PaperRouteRequest): Promise<Metadata> {
  const resolved = await resolvePaperRoute(request);
  if (!resolved.ok) return { title: "Not in the edition" };
  const payload = await loadPaper(resolved.paperId);
  const sectionTitle = resolved.section
    ? payload.paper.sections.find((s) => s.id === resolved.section)?.title
    : undefined;
  const title =
    resolved.face === DEFAULT_FACE
      ? (sectionTitle ?? payload.paper.title)
      : `${FACE_REGISTRY[resolved.face].label} · ${sectionTitle ?? payload.paper.title}`;
  const path =
    resolved.face === DEFAULT_FACE
      ? paperPath(resolved.paperId, resolved.section)
      : faceFallbackPath(resolved.paperId, resolved.face, resolved.section);
  const languages =
    resolved.face === "german" || resolved.face === "english"
      ? {
          de: absoluteUrl(faceFallbackPath(resolved.paperId, "german", resolved.section)),
          en: absoluteUrl(faceFallbackPath(resolved.paperId, "english", resolved.section)),
        }
      : undefined;
  const canonical =
    resolved.face === "german" || resolved.face === "english"
      ? absoluteUrl(path)
      : absoluteUrl(paperPath(resolved.paperId, resolved.section));
  return {
    title,
    description: payload.paper.description,
    alternates: {
      canonical,
      ...(languages === undefined ? {} : { languages }),
    },
  };
}

export async function readerSitemapEntries(): Promise<
  readonly { url: string; alternates?: { languages: Record<string, string> } }[]
> {
  const papers = await listReadablePapers();
  const entries: { url: string; alternates?: { languages: Record<string, string> } }[] = [];
  for (const paper of papers) {
    entries.push({ url: absoluteUrl(paperPath(paper)) });
    const payload = await loadPaper(paper);
    for (const section of payload.paper.sections) {
      entries.push({ url: absoluteUrl(paperPath(paper, section.id)) });
    }
    entries.push({
      url: absoluteUrl(faceFallbackPath(paper, "german")),
      alternates: {
        languages: {
          de: absoluteUrl(faceFallbackPath(paper, "german")),
          en: absoluteUrl(faceFallbackPath(paper, "english")),
        },
      },
    });
    entries.push({
      url: absoluteUrl(faceFallbackPath(paper, "english")),
      alternates: {
        languages: {
          de: absoluteUrl(faceFallbackPath(paper, "german")),
          en: absoluteUrl(faceFallbackPath(paper, "english")),
        },
      },
    });
    for (const section of payload.paper.sections) {
      entries.push({
        url: absoluteUrl(faceFallbackPath(paper, "german", section.id)),
        alternates: {
          languages: {
            de: absoluteUrl(faceFallbackPath(paper, "german", section.id)),
            en: absoluteUrl(faceFallbackPath(paper, "english", section.id)),
          },
        },
      });
      entries.push({
        url: absoluteUrl(faceFallbackPath(paper, "english", section.id)),
        alternates: {
          languages: {
            de: absoluteUrl(faceFallbackPath(paper, "german", section.id)),
            en: absoluteUrl(faceFallbackPath(paper, "english", section.id)),
          },
        },
      });
    }
  }
  return entries;
}
