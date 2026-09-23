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
 * - Removed all third-party external fonts and CDN requests.
 * - 2026-09-22: the card is the site's own, drawn by src/components/share/shareCards.tsx: the four
 *   printed first pages under the days Annalen der Physik received them, set in the site's
 *   Newsreader and Plus Jakarta Sans. It replaces a template card (a red frame, a star badge, a
 *   pill) that promised an English translation not yet started and named the fourth paper by a
 *   formula it never writes. Every page without a card of its own shares this one.
 * - 2026-09-23: renamed from opengraph-image.tsx, so Next no longer treats it as the root Open Graph
 *   image. That convention's URL has no extension (Vercel answered 308 and application/octet-stream)
 *   and it overrode the layout's /share/home.png on every page without a card. The same card is
 *   published at /share/home.png; this module stays for its test and its attribution record.
 */

import { CARD, renderSiteCard } from "../components/share/shareCards.tsx";

export const runtime = "nodejs";
export const dynamic = "force-static";
export const alt =
  "The first printed pages of Einstein's four papers of 1905, each under the day Annalen der Physik received it";
export const size = CARD;
export const contentType = "image/png";

export default async function Image() {
  return renderSiteCard();
}
