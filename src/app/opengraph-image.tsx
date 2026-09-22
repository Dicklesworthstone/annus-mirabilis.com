/**
 * Extracted from classic-patents.com
 * Source repository: https://github.com/Dicklesworthstone/classic-patents.com
 * Source path: src/app/opengraph-image.tsx
 * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5
 * License: MIT License (with OpenAI/Anthropic Rider)
 * Preserved license text: /LICENSE
 *
 * Modifications:
 * - Adapted branding and typography to Annus Mirabilis (1905 Albert Einstein Annalen der Physik papers).
 * - Removed all third-party external fonts and CDN requests; uses system serif/monospace fonts and inline styling.
 * - Adheres strictly to WCAG contrast and local-only asset policy.
 */

import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const dynamic = "force-static";
export const alt = "Annus Mirabilis: a critical edition of Albert Einstein's four papers of 1905";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "space-between",
        backgroundColor: "#fbfbfb",
        padding: "60px 70px",
        border: "16px solid #ae2119",
        fontFamily: "serif",
      }}
    >
      {/* Top Header Row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "10px",
              backgroundColor: "#ae2119",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/*
              am-jfyo. This was the character U+2726 BLACK FOUR POINTED STAR. Satori's
              built-in font does not cover it, so every single build reached the network
              for a font, got HTTP 400, and shipped the mark as an empty missing-glyph
              box - verified by looking at out/opengraph-image, not inferred from the
              warning. The file's own header has claimed since the donor extraction that
              it makes no third-party font request; that claim was false for this one
              glyph on every build.

              Drawn instead of typed. The mark is decoration, not text a reader reads, so
              it needs no font and no network: the three self-hosted families in
              public/fonts cover none of U+2726 either, and bundling a fourth for one
              ornament would be a licensing and subsetting decision rather than a build
              fix.
            */}
            {/* No <title>: Satori renders it as visible TEXT in the raster, which
                printed "Annus Mirabilis mark" across the header the first time I tried
                it. The card's accessible name is the route's own `alt` export, which is
                what every consumer of an Open Graph image actually uses. */}
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="#ffffff"
              role="img"
              aria-label="Annus Mirabilis mark"
            >
              <path d="M12 1 L14 10 L23 12 L14 14 L12 23 L10 14 L1 12 L10 10 Z" />
            </svg>
          </div>
          <span
            style={{
              fontSize: "28px",
              fontWeight: "bold",
              letterSpacing: "3px",
              color: "#3f3f3f",
              display: "flex",
            }}
          >
            ANNUS MIRABILIS
          </span>
        </div>

        <div
          style={{
            padding: "6px 16px",
            borderRadius: "999px",
            backgroundColor: "#d3d3d3",
            border: "2px solid #616161",
            color: "#3f3f3f",
            fontSize: "15px",
            fontFamily: "monospace",
            fontWeight: "bold",
          }}
        >
          1905 CRITICAL EDITION &amp; DISCOVERY LABORATORY
        </div>
      </div>

      {/* Center Headline */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {/*
          am-ecuf. This was one text node, a <br />, and a second text node, and the
          emitted card showed ONE line running off the right edge: "Albert Einstein's
          Miraculous Year, Decoded &" cut mid-glyph, with "Made Interactive." absent.
          The markup said <br /> and the markup is what misled - this image is rendered
          by Satori at build time, not by a browser, and <br /> is not a line break
          there. Two explicit children of a column flex container are.

          maxWidth is the card's real content width, not a guess: 1200 total, less the
          16px border on each side, less the 70px padding on each side, is 1028. A
          headline longer than one line now wraps inside the card instead of leaving it.
        */}
        <h1
          style={{
            display: "flex",
            flexDirection: "column",
            maxWidth: "1028px",
            fontSize: "54px",
            fontWeight: "bold",
            color: "#3f3f3f",
            lineHeight: 1.15,
            margin: 0,
          }}
        >
          <span>Albert Einstein&apos;s four papers</span>
          <span>of 1905, and how to read them.</span>
        </h1>
        <p
          style={{
            fontSize: "22px",
            color: "#616161",
            maxWidth: "920px",
            margin: 0,
            fontStyle: "italic",
          }}
        >
          The original Annalen der Physik German text, sentence-aligned English translation,
          exploratory instruments, and scientific discovery sequences.
        </p>
      </div>

      {/* Bottom Papers Pills */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          width: "100%",
          borderTop: "2px solid #d3d3d3",
          paddingTop: "24px",
        }}
      >
        <div
          style={{
            fontSize: "15px",
            fontFamily: "monospace",
            color: "#ae2119",
            fontWeight: "bold",
          }}
        >
          Light Quanta (17, 132)
        </div>
        <span style={{ color: "#616161" }}>•</span>
        <div
          style={{
            fontSize: "15px",
            fontFamily: "monospace",
            color: "#ae2119",
            fontWeight: "bold",
          }}
        >
          Brownian Motion (17, 549)
        </div>
        <span style={{ color: "#616161" }}>•</span>
        <div
          style={{
            fontSize: "15px",
            fontFamily: "monospace",
            color: "#ae2119",
            fontWeight: "bold",
          }}
        >
          Special Relativity (17, 891)
        </div>
        <span style={{ color: "#616161" }}>•</span>
        <div
          style={{
            fontSize: "15px",
            fontFamily: "monospace",
            color: "#ae2119",
            fontWeight: "bold",
          }}
        >
          E = mc² (18, 639)
        </div>
        <span style={{ color: "#616161" }}>•</span>
        <div
          style={{
            fontSize: "15px",
            fontFamily: "monospace",
            color: "#616161",
          }}
        >
          annus-mirabilis.com
        </div>
      </div>
    </div>,
    {
      ...size,
    },
  );
}
