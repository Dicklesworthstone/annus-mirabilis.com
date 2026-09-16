// @ts-nocheck
import Tesseract from "tesseract.js";

export async function recognizeImage(image: Buffer) {
  return Tesseract.recognize(image);
}
