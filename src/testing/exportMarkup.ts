/**
 * Renders an element the way the static export does: every Suspense boundary finished first.
 *
 * Some client components reach the page through React.lazy (src/reader/lazyIslands.tsx), so
 * their code loads only on the pages that use them. renderToStaticMarkup cannot wait for that:
 * on a module no earlier test has loaded it renders the boundary's fallback, which is nothing,
 * and the same assertion then passes or fails depending on which test ran first. Next's static
 * generation instead waits for allReady (continueFizzStream in next/dist/server/stream-utils),
 * and React writes each finished boundary in place. This does the same, so a test sees what a
 * reader without JavaScript is served.
 *
 * The output differs from renderToStaticMarkup only in React's comment markers (a Suspense
 * boundary's <!--$--> and <!--/$-->, and <!-- --> between adjacent text nodes), which neither
 * textContent nor a selector sees.
 */
import type { ReactElement } from "react";
import { renderToReadableStream } from "react-dom/server";

export async function exportMarkup(element: ReactElement): Promise<string> {
  const stream = await renderToReadableStream(element);
  await stream.allReady;
  return new Response(stream).text();
}
