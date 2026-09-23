import { renderShareCard, shareCardIds } from "../../../components/share/shareCards.tsx";

// The share cards as build-time static files, /share/<id>.png: the site, each paper by slug, and
// the instruments that have one. Pages name theirs in their Open Graph metadata (shareImages.ts).
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return shareCardIds().map((id) => ({ card: `${id}.png` }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ card: string }> }) {
  const { card } = await params;
  const response = renderShareCard(card.replace(/\.png$/, ""));
  return response ?? new Response("Not found", { status: 404 });
}
