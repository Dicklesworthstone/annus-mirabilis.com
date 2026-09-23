import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { THEME_TOKENS } from "../../app/theme/tokens.ts";
import { dayAndMonth, dayMonthParts, type FirstPage, loadFirstPages } from "../home/firstPages.ts";
import { defaultInstance } from "./staticFont.ts";

/**
 * THE SHARE CARDS: WHAT A LINK TO THIS SITE LOOKS LIKE WHEN SOMEONE POSTS IT.
 *
 * Every page used to share one card, the donor's template: a red frame, a star badge, a pill
 * reading "1905 CRITICAL EDITION & DISCOVERY LABORATORY", and a line promising a
 * "sentence-aligned English translation" that has not been started. It called the fourth paper
 * "E = mc²", a formula the home page points out that paper never writes.
 *
 * A card now shows the site's signature, the printed first page. A paper's card carries that
 * page, the paper's title as printed, the day Annalen der Physik received it, and one mark per
 * printed page. The site's card shows all four first pages under their received dates, as the
 * home page does, and an instrument's card carries its paper's first page. Every fact on a card
 * comes from the provenance receipt, through loadFirstPages, as the home row's do.
 *
 * Set in the site's own Newsreader and Plus Jakarta Sans (staticFont.ts says how), in the light
 * theme's colours. The plates are grayscale JPEGs of the same crops the site serves
 * (public/figures/plates/share/), because the renderer reads JPEG and PNG and not WebP.
 */

export const CARD = { width: 1200, height: 630 } as const;
/** Nothing is drawn nearer an edge than this. opengraph-image.test.tsx checks the gutter. */
export const CARD_MARGIN = 56;

const COLOUR = THEME_TOKENS.annalen;
const SERIF = "Newsreader";
const SANS = "Plus Jakarta Sans";

/** The instruments with a card of their own: the page's title and the question it opens on. */
export const LAB_CARDS = {
  "bm-01": {
    paperKey: "ap-17-549",
    title: "The Brownian tracer ensemble",
    question: "Where does a wandering particle end up?",
  },
} as const;
export type LabCardId = keyof typeof LAB_CARDS;

/** Card ids, each published as /share/<id>.png: the site, the four papers by slug, and labs. */
export function shareCardIds(): readonly string[] {
  return ["home", ...loadFirstPages().map((p) => p.slug), ...Object.keys(LAB_CARDS)];
}

/** The Open Graph image entry for a card, as a page's metadata lists it. */
export function shareImage(id: string, alt: string) {
  return { url: `/share/${id}.png`, width: CARD.width, height: CARD.height, alt };
}

const ROOT = process.cwd();
let fonts: { name: string; data: ArrayBuffer }[] | undefined;
function cardFonts() {
  if (!fonts) {
    const load = (path: string) => {
      const font = defaultInstance(readFileSync(join(ROOT, "public/fonts", path)));
      return font.buffer.slice(font.byteOffset, font.byteOffset + font.byteLength) as ArrayBuffer;
    };
    fonts = [
      { name: SERIF, data: load("newsreader/Newsreader-Variable.ttf") },
      { name: SANS, data: load("plus-jakarta-sans/PlusJakartaSans-Variable.ttf") },
    ];
  }
  return fonts;
}

function plate(key: string): string {
  const jpeg = readFileSync(join(ROOT, "public/figures/plates/share", `${key}.jpg`));
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

/** The plate box's own shape, 400:662, at a given height. */
const plateWidth = (height: number) => Math.round((height * 400) / 662);

function Plate({ paperKey, height }: { paperKey: string; height: number }) {
  return (
    // biome-ignore lint/performance/noImgElement: rendered to a PNG by next/og, never served as HTML
    <img
      src={plate(paperKey)}
      alt=""
      width={plateWidth(height)}
      height={height}
      style={{
        border: `1px solid ${COLOUR.rule}`,
        boxShadow: "0 12px 26px -16px rgba(0, 0, 0, 0.3)",
      }}
    />
  );
}

/** One mark per printed page, at one pitch, so the marks' lengths compare as the counts do. */
function PageMarks({ pages }: { pages: number }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {Array.from({ length: pages }, (_, n) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: the marks are identical and never reorder
          key={n}
          style={{ width: 3, height: 20, background: COLOUR.ink }}
        />
      ))}
    </div>
  );
}

function Eyebrow({ children }: { children: string }) {
  return (
    <div style={{ fontFamily: SANS, fontSize: 19, letterSpacing: 3, color: COLOUR.muted }}>
      {children.toUpperCase()}
    </div>
  );
}

function Wordmark() {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
      <div style={{ fontSize: 34, color: COLOUR.accent }}>Annus Mirabilis</div>
      <div style={{ fontFamily: SANS, fontSize: 17, color: COLOUR.muted }}>annus-mirabilis.com</div>
    </div>
  );
}

const locator = (paper: FirstPage) =>
  `Annalen der Physik ${paper.volume}, ${paper.firstPage}–${paper.lastPage}`;

/** A plate on the left, and the words about it filling the rest of the card. */
function PlateCard({
  paper,
  eyebrow,
  title,
  subtitle,
  foot,
}: {
  paper: FirstPage;
  eyebrow: string;
  title: string;
  subtitle: string;
  foot: string;
}) {
  const height = CARD.height - 2 * CARD_MARGIN;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        padding: CARD_MARGIN,
        background: COLOUR.paper,
        color: COLOUR.ink,
        fontFamily: SERIF,
      }}
    >
      <Plate paperKey={paper.key} height={height} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          flex: 1,
          marginLeft: 64,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <Eyebrow>{eyebrow}</Eyebrow>
          <div style={{ fontSize: 84, lineHeight: 1.02, marginTop: 20 }}>{title}</div>
          <div style={{ fontSize: 31, lineHeight: 1.3, marginTop: 24, color: COLOUR.muted }}>
            {subtitle}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <PageMarks pages={paper.pages} />
          <div style={{ fontFamily: SANS, fontSize: 19, color: COLOUR.muted, marginTop: 12 }}>
            {foot}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 26,
              paddingTop: 20,
              borderTop: `1px solid ${COLOUR.rule}`,
            }}
          >
            <Wordmark />
          </div>
        </div>
      </div>
    </div>
  );
}

function PaperCard({ paper }: { paper: FirstPage }) {
  return (
    <PlateCard
      paper={paper}
      eyebrow={`Received ${dayAndMonth(paper.received)} 1905`}
      title={paper.title}
      subtitle={paper.germanTitle}
      foot={`${paper.pages} pages · ${locator(paper)}`}
    />
  );
}

function LabCard({ id, paper }: { id: LabCardId; paper: FirstPage }) {
  const lab = LAB_CARDS[id];
  return (
    <PlateCard
      paper={paper}
      eyebrow={`An instrument · ${paper.title}`}
      title={lab.title}
      subtitle={lab.question}
      foot={`From the paper received ${dayAndMonth(paper.received)} 1905 · ${locator(paper)}`}
    />
  );
}

/** The four first pages under their received dates, as the home page opens. */
function SiteCard({ papers }: { papers: readonly FirstPage[] }) {
  const plateHeight = 356;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: CARD_MARGIN,
        background: COLOUR.paper,
        color: COLOUR.ink,
        fontFamily: SERIF,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div style={{ fontSize: 50, lineHeight: 1 }}>Four papers, 1905</div>
        <div style={{ fontSize: 34, color: COLOUR.accent }}>Annus Mirabilis</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {papers.map((paper) => {
          const { day, month } = dayMonthParts(paper.received);
          return (
            <div key={paper.key} style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 34, lineHeight: 1 }}>{day}</div>
                <div style={{ fontFamily: SANS, fontSize: 15, letterSpacing: 2.5 }}>
                  {month.toUpperCase()}
                </div>
              </div>
              <Plate paperKey={paper.key} height={plateHeight} />
              <div style={{ fontSize: 24, lineHeight: 1.4, marginTop: 6 }}>{paper.title}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The card for an id, as a PNG response, or null for an id with no card. No font or image is
 * fetched: both come from the repository, so a missing glyph is a visible gap rather than a
 * request (opengraph-image.test.tsx checks that none is made).
 */
export function renderShareCard(id: string): ImageResponse | null {
  if (id === "home") return renderSiteCard();
  const papers = loadFirstPages();
  const options = { ...CARD, fonts: cardFonts() };
  const paper = papers.find((p) => p.slug === id);
  if (paper) return new ImageResponse(<PaperCard paper={paper} />, options);
  if (id in LAB_CARDS) {
    const lab = LAB_CARDS[id as LabCardId];
    const labPaper = papers.find((p) => p.key === lab.paperKey);
    if (labPaper)
      return new ImageResponse(<LabCard id={id as LabCardId} paper={labPaper} />, options);
  }
  return null;
}

/** The site's own card, which every page without a card of its own shares. */
export function renderSiteCard(): ImageResponse {
  return new ImageResponse(<SiteCard papers={loadFirstPages()} />, { ...CARD, fonts: cardFonts() });
}
