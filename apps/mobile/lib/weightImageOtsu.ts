/**
 * Pure pixel-math for the weight-photo preprocessing pipeline, split out
 * from lib/weightImagePreprocess.ts so it carries no native (Skia /
 * expo-file-system) imports and can be unit-tested directly. See
 * weightImagePreprocess.ts for how these are wired into the Skia pipeline
 * and why the transform is needed (seven-segment scale displays).
 */

/** Otsu's method: the 0..255 threshold maximizing between-class variance of
 * a 256-bin intensity histogram. Pure + deterministic. */
export function otsuThreshold(histogram: number[]): number {
  const total = histogram.reduce((a, b) => a + b, 0);
  if (total === 0) return 127;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * histogram[i];
  let sumB = 0;
  let wB = 0;
  let maxVar = -1;
  let threshold = 127;
  for (let i = 0; i < 256; i++) {
    wB += histogram[i];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += i * histogram[i];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) {
      maxVar = between;
      threshold = i;
    }
  }
  return threshold;
}

/** 256-bin histogram from one-byte-per-pixel luma. */
export function lumaHistogram(luma: Uint8Array): number[] {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < luma.length; i++) hist[luma[i]]++;
  return hist;
}

/**
 * Thresholds luma to black/white, choosing polarity so the DIGITS (the
 * minority of pixels on a scale display) become white on black, then
 * applies a 3x3 max-filter (dilation) to thicken the thin seven-segment
 * strokes. Returns a packed RGBA buffer (opaque).
 */
export function binarizeAndDilate(
  luma: Uint8Array,
  width: number,
  height: number,
  threshold: number
): Uint8Array {
  const n = width * height;
  let below = 0;
  for (let i = 0; i < n; i++) if (luma[i] < threshold) below++;
  const above = n - below;
  const digitsAreDark = below <= above;

  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const isDark = luma[i] < threshold;
    mask[i] = (digitsAreDark ? isDark : !isDark) ? 1 : 0;
  }

  const dilated = new Uint8Array(n);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let on = 0;
      for (let dy = -1; dy <= 1 && !on; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= width) continue;
          if (mask[yy * width + xx]) {
            on = 1;
            break;
          }
        }
      }
      dilated[y * width + x] = on;
    }
  }

  const rgba = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const v = dilated[i] ? 255 : 0;
    const o = i * 4;
    rgba[o] = v;
    rgba[o + 1] = v;
    rgba[o + 2] = v;
    rgba[o + 3] = 255;
  }
  return rgba;
}
