import { currentSearchShards, readCurrentSearchShard } from "../../../search/server.ts";

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  return currentSearchShards();
}
export async function GET(_request: Request, { params }: { params: Promise<{ shard: string }> }) {
  const { shard } = await params;
  const text = await readCurrentSearchShard(shard);
  if (text === null) return new Response("Not found", { status: 404 });
  return new Response(text, { headers: { "Content-Type": "application/json; charset=utf-8" } });
}
