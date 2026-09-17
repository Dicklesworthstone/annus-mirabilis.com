/** The offline document's only script. No storage, network, or application runtime. */
export function initializeOfflineDetail() {
  const root = document.documentElement;
  const detail = document.querySelector<HTMLSelectElement>("[data-offline-detail]");
  const modern = document.querySelector<HTMLInputElement>("[data-offline-modern]");
  const status = document.querySelector<HTMLElement>("[data-offline-status]");
  if (!detail || !modern) return;
  function apply(announce: boolean) {
    if (!detail || !modern) return;
    const value = ["0", "1", "2"].includes(detail.value) ? detail.value : "1";
    root.dataset.detail = value;
    root.dataset.lens = modern.checked ? "modern" : "paper";
    for (const block of document.querySelectorAll<HTMLElement>("[data-reading]")) {
      block.hidden =
        block.dataset.reading === "3" ? !modern.checked : block.dataset.reading !== value;
    }
    if (announce && status) {
      status.textContent = `${detail.selectedOptions[0]?.textContent ?? "Full explanation"}. ${modern.checked ? "Modern qualifications shown." : "Modern qualifications hidden."}`;
    }
  }
  const initial = new URLSearchParams(location.search).get("detail");
  const aliases: Record<string, string> = { overview: "0", full: "1", steps: "2" };
  detail.value =
    initial && ["0", "1", "2"].includes(initial) ? initial : (aliases[initial ?? ""] ?? "1");
  detail.disabled = false;
  modern.disabled = false;
  detail.addEventListener("change", () => apply(true));
  modern.addEventListener("change", () => apply(true));
  apply(false);
}
export const OFFLINE_DETAIL_SOURCE = `(${initializeOfflineDetail.toString()})();`;
