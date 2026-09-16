import { spawn } from "node:child_process";

export function runTesseract() {
  return spawn("tesseract", ["input.png", "output"]);
}
