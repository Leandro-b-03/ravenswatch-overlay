// Pixel-level preprocessing shared by the live worker (canvas ImageData) and
// the headless ocr-bench (jimp bitmap): grayscale → contrast stretch → invert
// when the image is mostly dark (Ravenswatch shows light text on dark cards;
// Tesseract reads dark-on-light far more reliably).

export function preprocessPixels(px: Uint8Array | Uint8ClampedArray): void {
  let min = 255
  let max = 0
  let sum = 0
  for (let i = 0; i < px.length; i += 4) {
    const gray = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]
    px[i] = px[i + 1] = px[i + 2] = gray
    if (gray < min) min = gray
    if (gray > max) max = gray
    sum += gray
  }
  const range = Math.max(1, max - min)
  const mean = sum / (px.length / 4)
  const invert = mean - min < (max - min) / 2
  for (let i = 0; i < px.length; i += 4) {
    let v = ((px[i] - min) / range) * 255
    if (invert) v = 255 - v
    px[i] = px[i + 1] = px[i + 2] = v
  }
}
