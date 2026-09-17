import { readSearchManifest } from "../../../search/server.ts";

export const dynamic = "force-static";

export async function GET() {
  const { text } = await readSearchManifest();
  return new Response(text, { headers: { "Content-Type": "application/json; charset=utf-8" } });
}
