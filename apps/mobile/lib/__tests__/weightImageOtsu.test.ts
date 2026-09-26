import {
  otsuThreshold,
  lumaHistogram,
  binarizeAndDilate,
} from '../weightImageOtsu';

describe('otsuThreshold', () => {
  it('returns 127 for an empty histogram', () => {
    expect(otsuThreshold(new Array(256).fill(0))).toBe(127);
  });

  it('splits a clean bimodal histogram between the two peaks', () => {
    const hist = new Array(256).fill(0);
    hist[10] = 500; // dark cluster
    hist[240] = 500; // light cluster
    const t = otsuThreshold(hist);
    expect(t).toBeGreaterThanOrEqual(10);
    expect(t).toBeLessThan(240);
  });
});

describe('lumaHistogram', () => {
  it('counts pixel intensities into 256 bins', () => {
    const hist = lumaHistogram(new Uint8Array([0, 0, 255, 128]));
    expect(hist[0]).toBe(2);
    expect(hist[255]).toBe(1);
    expect(hist[128]).toBe(1);
    expect(hist.reduce((a, b) => a + b, 0)).toBe(4);
  });
});

describe('binarizeAndDilate', () => {
  // 5x5, single dark pixel in the centre on a light background (classic LCD
  // polarity: digits dark, minority). Expect the digit to become white and,
  // after 3x3 dilation, its 8 neighbours too.
  it('turns a dark minority digit white and dilates it', () => {
    const w = 5;
    const h = 5;
    const luma = new Uint8Array(w * h).fill(255);
    luma[2 * w + 2] = 0; // centre dark
    const rgba = binarizeAndDilate(luma, w, h, 128);

    const isWhite = (x: number, y: number) => rgba[(y * w + x) * 4] === 255;
    // centre + 3x3 block around it are white
    expect(isWhite(2, 2)).toBe(true);
    expect(isWhite(1, 1)).toBe(true);
    expect(isWhite(3, 3)).toBe(true);
    // a far corner stays black
    expect(isWhite(0, 0)).toBe(false);
    // output is opaque RGBA
    expect(rgba[3]).toBe(255);
    expect(rgba.length).toBe(w * h * 4);
  });

  it('handles inverted polarity (light minority digit on dark bg)', () => {
    const w = 5;
    const h = 5;
    const luma = new Uint8Array(w * h).fill(0); // dark background
    luma[2 * w + 2] = 255; // one bright digit pixel (minority)
    const rgba = binarizeAndDilate(luma, w, h, 128);
    const isWhite = (x: number, y: number) => rgba[(y * w + x) * 4] === 255;
    // the bright digit pixel is treated as the digit -> white
    expect(isWhite(2, 2)).toBe(true);
    expect(isWhite(0, 0)).toBe(false);
  });
});
