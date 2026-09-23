import { readFile } from "node:fs/promises";
import { join } from "node:path";

// The site's print stylesheet as a build-time static file, /print.css. The root layout links it
// with media="print", so a screen never waits for it and no route's first load carries it; the
// reasons and the rules are in src/platform/print/sitePrint.css.
export const dynamic = "force-static";

export async function GET() {
  const css = await readFile(join(process.cwd(), "src/platform/print/sitePrint.css"), "utf8");
  return new Response(css, { headers: { "Content-Type": "text/css; charset=utf-8" } });
}
