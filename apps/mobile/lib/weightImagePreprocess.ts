import {
  Skia,
  ColorType,
  AlphaType,
  ImageFormat,
} from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import { otsuThreshold, lumaHistogram, binarizeAndDilate } from './weightImageOtsu';

/**
 * Preprocesses a scale photo so ML Kit's Latin recognizer can read a
 * seven-segment display. Confirmed on-device (2026-09-25): ML Kit returns
 * an empty string on a low-contrast LCD (dark digits on a pale-green
 * background) and only reads the digits once the image is turned into
 * high-contrast white-on-black. This module does that transform:
 * grayscale -> Otsu threshold -> binarize with auto polarity (digits become
 * white) -> light dilation to thicken the sparse segments -> 2x upscale.
 *
 * The heavy pixel work is deliberately split into small pure functions
 * (otsuThreshold / binarizeAndDilate) that operate on plain typed arrays so
 * they can be unit-tested without a native Skia context.
 *
 * Caveat: even after this, ML Kit reliably drops the seven-segment "7"
 * (and likely "1"); the Weight field stays user-editable so those are
 * corrected by hand. This raises OCR success on the common digits, it does
 * not make it authoritative.
 */

// Downscale wide photos to this working width before the (JS) pixel passes,
// so a multi-megapixel camera photo doesn't make the threshold pass slow.
const WORKING_MAX_WIDTH = 1000;
// ML Kit detects small/thin glyphs more reliably on a larger canvas; 2x the
// working image is enough without ballooning the encoded file.
const OUTPUT_UPSCALE = 2;

const GRAYSCALE_MATRIX = [
  0.299, 0.587, 0.114, 0, 0,
  0.299, 0.587, 0.114, 0, 0,
  0.299, 0.587, 0.114, 0, 0,
  0, 0, 0, 1, 0,
];

/**
 * Runs the full Skia pipeline. Returns a file:// URI to a processed PNG in
 * the cache directory, or null if anything fails (caller then falls back to
 * the original photo, so preprocessing can never make OCR worse than before).
 */
export async function preprocessWeightPhoto(uri: string): Promise<string | null> {
  try {
    const data = await Skia.Data.fromURI(uri);
    const encoded = Skia.Image.MakeImageFromEncoded(data);
    if (!encoded) return null;

    const srcW = encoded.width();
    const srcH = encoded.height();
    if (srcW === 0 || srcH === 0) return null;

    const scale = srcW > WORKING_MAX_WIDTH ? WORKING_MAX_WIDTH / srcW : 1;
    const w = Math.max(1, Math.round(srcW * scale));
    const h = Math.max(1, Math.round(srcH * scale));

    // Pass 1: draw grayscale into an offscreen surface at working size.
    const graySurface = Skia.Surface.MakeOffscreen(w, h);
    if (!graySurface) return null;
    const grayPaint = Skia.Paint();
    grayPaint.setColorFilter(Skia.ColorFilter.MakeMatrix(GRAYSCALE_MATRIX));
    graySurface
      .getCanvas()
      .drawImageRect(
        encoded,
        Skia.XYWHRect(0, 0, srcW, srcH),
        Skia.XYWHRect(0, 0, w, h),
        grayPaint
      );
    graySurface.flush();
    const graySnap = graySurface.makeImageSnapshot();

    const info = {
      width: w,
      height: h,
      colorType: ColorType.RGBA_8888,
      alphaType: AlphaType.Opaque,
    };
    const pixels = graySnap.readPixels(0, 0, info) as Uint8Array | null;
    if (!pixels) return null;

    // R channel == luma (image is grayscale).
    const luma = new Uint8Array(w * h);
    for (let i = 0; i < luma.length; i++) luma[i] = pixels[i * 4];

    const threshold = otsuThreshold(lumaHistogram(luma));
    const binRgba = binarizeAndDilate(luma, w, h, threshold);

    const binImage = Skia.Image.MakeImage(info, Skia.Data.fromBytes(binRgba), w * 4);
    if (!binImage) return null;

    // Pass 2: upscale the binarized image for ML Kit.
    const outW = w * OUTPUT_UPSCALE;
    const outH = h * OUTPUT_UPSCALE;
    const outSurface = Skia.Surface.MakeOffscreen(outW, outH);
    if (!outSurface) return null;
    outSurface
      .getCanvas()
      .drawImageRect(
        binImage,
        Skia.XYWHRect(0, 0, w, h),
        Skia.XYWHRect(0, 0, outW, outH),
        Skia.Paint()
      );
    outSurface.flush();
    const outImage = outSurface.makeImageSnapshot();

    const png = outImage.encodeToBytes(ImageFormat.PNG, 100);
    const file = new File(Paths.cache, `weight_ocr_${Date.now()}.png`);
    file.create({ intermediates: true, overwrite: true });
    file.write(png);
    return file.uri;
  } catch {
    return null;
  }
}
