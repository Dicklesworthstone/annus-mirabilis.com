import { spawn } from "node:child_process";

export function renderPagesWithPdftoppm(pdfPath: string, outputPrefix: string) {
  return spawn("pdftoppm", ["-png", "-r", "300", pdfPath, outputPrefix]);
}
