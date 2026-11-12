import { anchorFromFaceHash } from "./anchors/faceSwitchPlace.ts";

export type PassageFace = "german" | "english" | "parallel" | "gloss" | "facsimile" | "reading";
export type PassageFaceLink = Readonly<{ href: string; label: string }>;

/** Only an existing paper route can own an exact passage transfer. */
export function passageFaceRoute(href: string, base: string) {
  let url: URL;
  try {
    url = new URL(href, base);
  } catch {
    return null;
  }
  if (url.origin !== new URL(base).origin) return null;
  const route =
    /^\/papers\/([a-z][a-z0-9-]*)\/(?:s\d+\/)?(?:view\/(german|english|parallel|gloss|facsimile)\/)?$/.exec(
      url.pathname,
    );
  return route ? { paper: route[1] as string, face: route[2] ?? "reading", url } : null;
}

/** Read the server's authored projection, retaining every many-to-many destination. */
export function passageFaceLinks(
  projections: readonly HTMLElement[],
  face: PassageFace,
): readonly PassageFaceLink[] {
  const key = face === "reading" ? "explanation" : face === "english" ? "english" : "german";
  const seen = new Set<string>();
  return projections.flatMap((projection) =>
    [...projection.querySelectorAll<HTMLAnchorElement>(`[data-projection="${key}"] a[href]`)]
      .filter((link) => {
        const href = link.getAttribute("href") ?? "";
        if (!href || seen.has(href)) return false;
        seen.add(href);
        return true;
      })
      .map((link) => ({
        // The other source faces publish these same source anchors; their existing arrival
        // owner resolves a section-scoped gloss or the facsimile's actual page mapping.
        href: (link.getAttribute("href") as string).replace(
          "/view/german/",
          key === "german" ? `/view/${face}/` : "/view/german/",
        ),
        label: link.textContent ?? "",
      })),
  );
}

/**
 * Source paragraphs own their rendered sentences. English groups publish the source-block
 * relation, and the parallel face's German block is named by its authored German projection.
 * No paragraph or translation relation is inferred from the spelling of a sentence id.
 */
export function passageProjectionsAt(root: HTMLElement, anchor: string): readonly HTMLElement[] {
  const current = root.ownerDocument.getElementById(anchor);
  if (!current || !root.contains(current)) return [];
  const projections = [...root.querySelectorAll<HTMLElement>("[data-passage-projections]")].filter(
    (projection) => !projection.hasAttribute("data-face-switch-choices"),
  );
  const exact = projections.filter(
    (projection) => projection.dataset.passageProjections === anchor,
  );
  if (exact.length > 0) return exact;
  const group = current.closest("[data-source-block], [data-source-footnote]");
  return projections.filter((projection) => {
    const owner = root.ownerDocument.getElementById(projection.dataset.passageProjections ?? "");
    if (owner && root.contains(owner) && (owner.contains(current) || group?.contains(owner)))
      return true;
    return passageFaceLinks([projection], "german").some((link) => {
      const source = passageFaceRoute(link.href, root.ownerDocument.location.href);
      const id = source ? anchorFromFaceHash(source.url.hash) : null;
      const block = id ? root.ownerDocument.getElementById(id) : null;
      return block !== null && root.contains(block) && block.contains(current);
    });
  });
}

export type PassageFaceOrigin = Readonly<{
  readingAnchor: string;
  href: string;
  paragraphs: readonly string[];
  relativeOffset: number;
}>;

/** A remembered source is useful only while this argument still explicitly explains it. */
export function passageFaceOrigin(
  value: unknown,
  anchor: string,
  projections: readonly HTMLElement[],
  base: string,
): PassageFaceOrigin | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const origin = value as Record<string, unknown>;
  if (
    origin.readingAnchor !== anchor ||
    typeof origin.href !== "string" ||
    origin.href.length > 4096 ||
    !Array.isArray(origin.paragraphs) ||
    origin.paragraphs.length > 200 ||
    !origin.paragraphs.every((href) => typeof href === "string" && href.length <= 4096) ||
    typeof origin.relativeOffset !== "number" ||
    !Number.isFinite(origin.relativeOffset) ||
    origin.relativeOffset < -0.8 ||
    origin.relativeOffset > 0.8
  )
    return null;
  const source = passageFaceRoute(origin.href, base);
  const current = passageFaceRoute(base, base);
  if (
    !source ||
    !current ||
    source.paper !== current.paper ||
    source.face === "reading" ||
    !anchorFromFaceHash(source.url.hash)
  )
    return null;
  const paragraphs = passageFaceLinks(projections, "german").map((link) => link.href);
  if (!origin.paragraphs.some((href) => paragraphs.includes(href as string))) return null;
  return origin as PassageFaceOrigin;
}
