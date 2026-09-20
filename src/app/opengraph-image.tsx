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
export const alt = "Annus Mirabilis — Albert Einstein 1905 Critical Edition";
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
        backgroundColor: "#eee7d7",
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
              color: "#ffffff",
              fontSize: "26px",
              fontWeight: "bold",
            }}
          >
            ✦
          </div>
          <span
            style={{
              fontSize: "28px",
              fontWeight: "bold",
              letterSpacing: "3px",
              color: "#1a1916",
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
            backgroundColor: "#cbc1ac",
            border: "2px solid #5c554a",
            color: "#1a1916",
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
            color: "#1a1916",
            lineHeight: 1.15,
            margin: 0,
          }}
        >
          <span>Albert Einstein&apos;s Miraculous Year,</span>
          <span>Decoded &amp; Made Interactive.</span>
        </h1>
        <p
          style={{
            fontSize: "22px",
            color: "#5c554a",
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
          borderTop: "2px solid #cbc1ac",
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
        <span style={{ color: "#5c554a" }}>•</span>
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
        <span style={{ color: "#5c554a" }}>•</span>
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
        <span style={{ color: "#5c554a" }}>•</span>
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
        <span style={{ color: "#5c554a" }}>•</span>
        <div
          style={{
            fontSize: "15px",
            fontFamily: "monospace",
            color: "#5c554a",
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
