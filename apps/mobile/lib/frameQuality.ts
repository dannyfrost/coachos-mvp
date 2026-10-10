/**
 * Pure image-quality assessment for the camera-guidance prototype. No camera,
 * no native deps — takes a grayscale pixel buffer so it is unit-testable and
 * cheap enough to run on low-end devices (Infinix X6528 / Unisoc). It judges
 * whether a frame is a GOOD PHOTO to capture; it does NOT read the weight and
 * a "ready" result does NOT guarantee the display is OCR-readable.
 *
 * Signals (computed inside the alignment ROI only, for speed):
 *  - brightness  : mean intensity (lighting)
 *  - glareFrac   : fraction of near-saturated pixels (specular glare)
 *  - blurVar     : variance of the Laplacian response (focus/sharpness)
 *  - contentFrac : fraction of edge pixels (is a display actually framed?)
 */
export type Roi = { x: number; y: number; w: number; h: number }; // fractions 0..1

export type Thresholds = {
  brightLo: number; brightHi: number;   // acceptable mean brightness
  glareMax: number;                      // max fraction of saturated pixels
  blurMin: number;                       // min Laplacian variance (sharpness)
  contentMin: number;                    // min edge fraction (a display is present)
  satLevel: number;                      // pixel value counted as "glare"
  edgeLevel: number;                     // |laplacian| above this = an edge
};

export const DEFAULT_THRESHOLDS: Thresholds = {
  brightLo: 45, brightHi: 215, glareMax: 0.06, blurMin: 90,
  contentMin: 0.02, satLevel: 245, edgeLevel: 28,
};

export type FrameAssessment = {
  brightness: number; glareFrac: number; blurVar: number; contentFrac: number;
  ready: boolean; reasons: string[];
};

const CENTER_ROI: Roi = { x: 0.15, y: 0.3, w: 0.7, h: 0.4 };

export function assessFrame(
  gray: Uint8Array | Uint8ClampedArray | number[],
  width: number,
  height: number,
  roi: Roi = CENTER_ROI,
  t: Thresholds = DEFAULT_THRESHOLDS
): FrameAssessment {
  const x0 = Math.max(1, Math.floor(roi.x * width));
  const y0 = Math.max(1, Math.floor(roi.y * height));
  const x1 = Math.min(width - 1, Math.floor((roi.x + roi.w) * width));
  const y1 = Math.min(height - 1, Math.floor((roi.y + roi.h) * height));

  let sum = 0, sat = 0, n = 0;
  let lapSum = 0, lapSqSum = 0, edges = 0, lapN = 0;
  const at = (x: number, y: number) => gray[y * width + x] as number;

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const v = at(x, y);
      sum += v; n++;
      if (v >= t.satLevel) sat++;
      // 4-neighbour Laplacian
      const lap = 4 * v - at(x - 1, y) - at(x + 1, y) - at(x, y - 1) - at(x, y + 1);
      lapSum += lap; lapSqSum += lap * lap; lapN++;
      if (Math.abs(lap) >= t.edgeLevel) edges++;
    }
  }
  if (n === 0 || lapN === 0) {
    return { brightness: 0, glareFrac: 0, blurVar: 0, contentFrac: 0, ready: false, reasons: ['no_frame'] };
  }

  const brightness = sum / n;
  const glareFrac = sat / n;
  const mean = lapSum / lapN;
  const blurVar = lapSqSum / lapN - mean * mean;   // variance of Laplacian
  const contentFrac = edges / lapN;

  const reasons: string[] = [];
  if (brightness < t.brightLo) reasons.push('too_dark');
  else if (brightness > t.brightHi) reasons.push('too_bright');
  if (glareFrac > t.glareMax) reasons.push('glare');
  if (contentFrac < t.contentMin) reasons.push('no_display');
  else if (blurVar < t.blurMin) reasons.push('blurry');   // only meaningful once content is present

  return { brightness, glareFrac, blurVar, contentFrac, ready: reasons.length === 0, reasons };
}

/** Human-facing guidance text for the first blocking reason. */
export function guidanceFor(a: FrameAssessment): string {
  if (a.ready) return 'Hold steady — ready to capture';
  const r = a.reasons[0];
  return {
    no_frame: 'Point the camera at your scale',
    no_display: 'Fit the scale display inside the box',
    too_dark: 'Too dark — add more light',
    too_bright: 'Too bright — reduce lighting',
    glare: 'Glare on the display — change the angle',
    blurry: 'Blurry — hold still and let it focus',
  }[r as string] ?? 'Adjust the scale position';
}
