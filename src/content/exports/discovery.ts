/**
 * Content discovery link helpers for machine-readable exports.
 *
 * Paper and section pages include `<link rel="alternate" ...>` pointing to their
 * corresponding machine-readable exports.
 *
 * Spec: am-cm-machine-readable-exports-xgy (Criterion 8).
 */

export interface ExportLinkDescriptor {
  readonly rel: "alternate";
  readonly type: string;
  readonly href: string;
  readonly title: string;
}

export function getPaperExportLinks(slug: string): readonly ExportLinkDescriptor[] {
  return [
    {
      rel: "alternate",
      type: "application/json",
      href: `/exports/v1/papers/${slug}.json`,
      title: "Machine-readable Paper Export (JSON)",
    },
    {
      rel: "alternate",
      type: "application/ld+json",
      href: `/exports/v1/jsonld/${slug}.json`,
      title: "Schema.org ScholarlyArticle (JSON-LD)",
    },
    {
      rel: "alternate",
      type: "application/tei+xml",
      href: `/exports/v1/tei/${slug}.xml`,
      title: "TEI P5 XML Critical Edition",
    },
    {
      rel: "alternate",
      type: "text/tab-separated-values",
      href: `/exports/v1/corpus/${slug}.tsv`,
      title: "Sentence-Aligned Bilingual Parallel Corpus (TSV)",
    },
  ];
}

export function getSectionExportLinks(
  slug: string,
  sectionId: string,
): readonly ExportLinkDescriptor[] {
  return [
    {
      rel: "alternate",
      type: "application/json",
      href: `/exports/v1/papers/${slug}/${sectionId}.json`,
      title: `Section ${sectionId} Export (JSON)`,
    },
    {
      rel: "alternate",
      type: "text/markdown",
      href: `/exports/v1/papers/${slug}/${sectionId}.md`,
      title: `Section ${sectionId} Export (Markdown)`,
    },
  ];
}

/**
 * Generates HTML string representing `<link rel="alternate" ...>` tags for inclusion in document head.
 */
export function formatExportLinkHtml(descriptors: readonly ExportLinkDescriptor[]): string {
  return descriptors
    .map(
      (d) =>
        `<link rel="${d.rel}" type="${d.type}" href="${d.href}" title="${d.title}" />`,
    )
    .join("\n");
}
