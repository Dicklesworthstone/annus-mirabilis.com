import { execSync } from "node:child_process";

export function extractTextLayer(pdfPath: string) {
  return execSync(`pdftotext ${pdfPath} -`).toString();
}
