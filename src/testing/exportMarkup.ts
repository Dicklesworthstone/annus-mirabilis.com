/**
 * Renders an element to HTML after every lazy client island has loaded.
 *
 * Some client components reach a page through React.lazy (src/reader/lazyIslands.tsx), so their
 * code loads only on the pages that use them. renderToStaticMarkup cannot wait for that: on a
 * module no earlier test has loaded, an island with no Suspense boundary of its own throws
 * ("A component suspended while responding to synchronous input"), and an island inside one
 * renders nothing, so the same assertion passes or fails by which test ran first. This waits for
 * allReady, as Next's static generation does (continueFizzStream).
 *
 * WHAT IT DOES NOT SHOW: WHERE NEXT PUTS THE MARKUP. With each island in its own <Suspense>,
 * this rendered the islands inline, while the Next build of 7b2ba7b1 wrote all four first
 * encounters into <div hidden id="S:0"> for a script to move, invisible without JavaScript.
 * Only a built page answers whether an island is visible to a reader without script.
 *
 * The output differs from renderToStaticMarkup in React's comment markers (a Suspense
 * boundary's <!--$--> and <!--/$-->, and <!-- --> between adjacent text nodes), which neither
 * textContent nor a selector sees, but an exact string match across two text nodes does.
 */
import type { ReactElement } from "react";
import { renderToReadableStream } from "react-dom/server";

export async function exportMarkup(element: ReactElement): Promise<string> {
  const stream = await renderToReadableStream(element);
  await stream.allReady;
  return new Response(stream).text();
}
