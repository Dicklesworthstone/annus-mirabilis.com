"use client";

/**
 * THE PRINTED PAGE THE READER HAS REACHED, beside the German text (TanElk's dispatch 52: "with the
 * page-following plate beside it at >=1200px, the text and the plate together fill the content
 * width"). Each block carries the page it was printed on (data-printed-page, from blockPages.ts);
 * as the reader scrolls, the plate shows the page of the block at the reading line.
 *
 * WITHOUT JAVASCRIPT the plate is the page this view opens on, beside the opening, and it does not
 * stick: a plate riding beside text from a later page would cite the wrong page of the scan. It
 * becomes sticky only once this component is following (data-following), which is also the only
 * state in which it can be right about every page.
 *
 * A PLAIN <img>, NOT next/image. This site builds with images.unoptimized, under which next/image
 * emits no srcset, and the plate is shown about 510px wide, 1,020 device pixels on a 2x screen:
 * the 640px plate alone is soft there. The srcset below offers the 1280px plate, and the browser
 * picks by the screen. Biome's noImgElement warns on this; the reason is here rather than
 * silenced.
 *
 * The page is where a block STARTS. A paragraph that runs from 553 onto 554 shows 553 until the
 * next block reaches the line; the plate answers "which page is this passage on", not "which
 * line of the plate is this".
 */
import { useEffect, useRef, useState } from "react";
import { pageAtLine } from "./pageAtLine.ts";

/** The reading line, as a fraction of the viewport from its top. */
const READING_LINE = 0.35;

export type FollowingPlateProps = Readonly<{
  /** Public directory holding <page>.webp (640px wide) and <page>-1280.webp. */
  dir: string;
  /** Printed pages that have a plate, ascending. */
  pages: readonly number[];
  /** The page this view opens on: where its first block was printed. */
  opening: number;
  /** The Annalen volume, for the caption and the image's text alternative. */
  volume: string;
  scanHref: string;
}>;

export function FollowingPlate({ dir, pages, opening, volume, scanHref }: FollowingPlateProps) {
  const [page, setPage] = useState(opening);
  const [following, setFollowing] = useState(false);
  const figure = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = figure.current?.closest("[data-reader-root]");
    if (!root) return;
    const blocks = [...root.querySelectorAll<HTMLElement>("[data-printed-page]")];
    if (blocks.length === 0) return;
    const available = new Set(pages);
    let frame = 0;
    const update = () => {
      frame = 0;
      const next = pageAtLine(blocks, window.innerHeight * READING_LINE, opening);
      if (available.has(next)) setPage(next);
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(update);
    };
    setFollowing(true);
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [pages, opening]);

  // The next page is fetched before the reader reaches it, so the plate turns without a blank.
  useEffect(() => {
    if (!following) return;
    const next = pages[pages.indexOf(page) + 1];
    if (next === undefined) return;
    const image = new Image();
    image.sizes = PLATE_SIZES;
    image.srcset = srcSet(dir, next);
  }, [following, page, pages, dir]);

  return (
    <figure
      ref={figure}
      className="source-plate"
      data-following={following ? "" : undefined}
      data-plate-page={page}
    >
      <a href={scanHref}>
        <img
          src={`${dir}/${page}.webp`}
          srcSet={srcSet(dir, page)}
          sizes={PLATE_SIZES}
          width={640}
          height={987}
          loading="lazy"
          decoding="async"
          alt={`Page ${page} as printed in Annalen der Physik, volume ${volume}.`}
        />
      </a>
      <figcaption>
        Page {page} as printed, Annalen der Physik, volume {volume}.{" "}
        <a href={scanHref}>Open the whole scan (PDF)</a>
      </figcaption>
    </figure>
  );
}

/** The plate is shown only from 75em, at about two fifths of the window. */
const PLATE_SIZES = "(min-width: 75em) 40vw, 100vw";

function srcSet(dir: string, page: number): string {
  return `${dir}/${page}.webp 640w, ${dir}/${page}-1280.webp 1280w`;
}
