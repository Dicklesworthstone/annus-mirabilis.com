/**
 * The photograph on /about/: Einstein at the patent office in Bern, about 1905.
 *
 * WHY IT IS HERE. The owner's decision (docs/PLAN_MINING_DECISIONS.md, "Photographs and likeness",
 * 2026-09-14) welcomes public-domain photographs of Einstein anywhere on the site with a source
 * credit, and names this one, ETH-Bibliothek Zürich, Bildarchiv, Portr_05937. The /sources and
 * /about bead (am-design-sources-about-zumd) asks for the credit: archive, photographer and date.
 *
 * WHAT THE ARCHIVE RECORDS, read from its own page on 2026-09-24 (ETH-Bibliothek, "Einstein online",
 * Beamter im Patentamt 1900-1909): caption "Einstein at the Patent Office Bern, ca. 1905",
 * photographer "Unknown", Public Domain Mark, doi:10.3932/ethz-a-000495740. The decision above and
 * Wikimedia Commons credit Lucien Chavan. The two disagree, so the caption gives the archive's
 * record and says the picture is also credited to Chavan, rather than choosing between them.
 *
 * WHERE THE FILE CAME FROM. Wikimedia Commons' copy of the archive's scan, uploaded from ETH and
 * credited there to "ETH-Bibliothek Zürich, Bildarchiv", 8206 x 11811 px, fetched 2026-09-24. The
 * digest is of that file as fetched. The site serves two greyscale reductions of it, 480 and 960
 * pixels wide, under public/figures/photographs/.
 *
 * This is not a SourceAsset (src/content/schemas/source.ts): that record describes a scan by its
 * printed pages, and a photograph has none. Nothing here is computed; it is what was read.
 */
export const PORTRAIT = {
  archive: "ETH-Bibliothek Zürich, Bildarchiv",
  identifier: "Portr_05937",
  doi: "10.3932/ethz-a-000495740",
  archiveCaption: "Einstein at the Patent Office Bern, ca. 1905",
  archivePhotographer: "Unknown",
  alsoCreditedTo: "Lucien Chavan",
  rights: "Public Domain Mark",
  recordReadAt: "2026-09-24",
  originUrl:
    "https://upload.wikimedia.org/wikipedia/commons/0/00/Albert_Einstein_ETH-Bib_Portr_05937.jpg",
  originSha256: "022a64bed2cac3f65d64a75edac19b96e2941f1d24ec50245ea78fdbb85e1e8e",
  originPixels: { width: 8206, height: 11811 },
  retrievedAt: "2026-09-24",
  served: [
    { path: "/figures/photographs/einstein-patent-office-480.webp", width: 480, height: 691 },
    { path: "/figures/photographs/einstein-patent-office-960.webp", width: 960, height: 1382 },
  ],
  alt: "Albert Einstein in his mid-twenties, in a checked suit, seated at a desk and looking to one side.",
} as const;
