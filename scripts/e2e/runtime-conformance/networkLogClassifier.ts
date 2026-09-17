export type NetworkKind = "worker" | "wasm" | "page" | "other";

export function classifyNetworkRequest(url: string): NetworkKind {
  const lower = url.toLowerCase();
  if (lower.endsWith(".wasm") || lower.includes("/wasm/")) return "wasm";
  if (lower.includes("worker") || lower.startsWith("blob:")) return "worker";
  if (
    lower.endsWith(".html") ||
    lower.endsWith(".js") ||
    lower.endsWith(".css") ||
    lower.includes("/apps/")
  ) {
    return "page";
  }
  return "other";
}
