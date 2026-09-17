import { FixtureAdapter, type FixtureAdapterOptions } from "./fixture-adapter.ts";
import { type CloudOcrAdapter, OcrRefusalError } from "./types.ts";

const FORBIDDEN_ADAPTER_PATTERNS = [
  /local/i,
  /tesseract/i,
  /ocrmypdf/i,
  /focr/i,
  /easyocr/i,
  /paddle/i,
  /pix2tex/i,
  /latex-ocr/i,
  /surya/i,
  /kraken/i,
  /doctr/i,
  /rapidocr/i,
  /ollama/i,
  /llava/i,
  /llama/i,
];

export function isForbiddenAdapterName(name: string): boolean {
  return FORBIDDEN_ADAPTER_PATTERNS.some((pattern) => pattern.test(name));
}

export interface LoadAdapterOptions extends FixtureAdapterOptions {
  adapterName?: string | undefined;
  nodeEnv?: string | undefined;
}

export function loadAdapter(
  nameOrOptions?: string | LoadAdapterOptions | undefined,
  extraOptions?: FixtureAdapterOptions | undefined,
): CloudOcrAdapter {
  let name: string | undefined;
  let options: LoadAdapterOptions = {};

  if (typeof nameOrOptions === "string") {
    name = nameOrOptions;
    options = { ...(extraOptions ?? {}) };
  } else if (nameOrOptions && typeof nameOrOptions === "object") {
    options = nameOrOptions;
    name = options.adapterName;
  }

  // Check env variable if name not explicitly passed
  if (!name) {
    name = process.env.OCR_ADAPTER;
  }

  if (!name || name.trim() === "") {
    throw new OcrRefusalError(
      "NO_ADAPTER",
      "No OCR adapter configured. Specify --adapter <name> or set OCR_ADAPTER. See docs/OCR_DISPATCH.md.",
    );
  }

  const normalized = name.trim().toLowerCase();

  if (isForbiddenAdapterName(normalized)) {
    throw new OcrRefusalError(
      "FORBIDDEN_ADAPTER_NAME",
      `Adapter name "${name}" matches a forbidden local recognition tool. Local OCR is strictly barred (AGENTS.md).`,
    );
  }

  if (normalized === "fixture") {
    const env = options.nodeEnv ?? process.env.NODE_ENV;
    if (env !== "test") {
      throw new OcrRefusalError(
        "FIXTURE_ADAPTER_OUTSIDE_TEST",
        `Fixture adapter loads only when NODE_ENV=test (got ${JSON.stringify(env ?? "")}). See docs/OCR_DISPATCH.md.`,
      );
    }
    return new FixtureAdapter(options);
  }

  throw new OcrRefusalError(
    "NO_ADAPTER",
    `Unknown OCR adapter: "${name}". No cloud adapter is committed. The dispatch interface is waiting on the user (am-src-ocr-dispatch-interface-m1ur). See docs/OCR_DISPATCH.md.`,
  );
}
