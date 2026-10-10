import { assessFrame, guidanceFor, DEFAULT_THRESHOLDS } from '../frameQuality';

const W = 160, H = 160;

function flat(v: number): Uint8Array {
  return new Uint8Array(W * H).fill(v);
}
function stripes(hi: number, lo: number, period: number): Uint8Array {
  const g = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      g[y * W + x] = Math.floor(x / period) % 2 === 0 ? hi : lo;
  return g;
}
function boxBlur(src: Uint8Array, k: number): Uint8Array {
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let s = 0, c = 0;
      for (let dx = -k; dx <= k; dx++) {
        const xx = x + dx;
        if (xx >= 0 && xx < W) { s += src[y * W + xx]; c++; }
      }
      out[y * W + x] = Math.round(s / c);
    }
  return out;
}

function t_ready_sharp_contrasty():void {
  const a = assessFrame(stripes(210, 40, 4), W, H);
  // @ts-ignore test assert
  if (!a.ready) throw new Error('sharp framed display should be ready: ' + JSON.stringify(a));
}
function t_too_dark():void {
  const a = assessFrame(flat(20), W, H);
  if (a.ready || a.reasons[0] !== 'too_dark') throw new Error('dark: ' + JSON.stringify(a));
}
function t_too_bright():void {
  const a = assessFrame(flat(252), W, H);
  if (a.ready || !(a.reasons.includes('too_bright') || a.reasons.includes('glare')))
    throw new Error('bright: ' + JSON.stringify(a));
}
function t_no_display_flat():void {
  const a = assessFrame(flat(128), W, H);
  if (a.ready || a.reasons[0] !== 'no_display') throw new Error('flat: ' + JSON.stringify(a));
}
function t_glare_patch():void {
  const g = stripes(180, 60, 5);
  for (let y = 60; y < 100; y++) for (let x = 40; x < 130; x++) g[y * W + x] = 255; // saturated blob
  const a = assessFrame(g, W, H);
  if (!a.reasons.includes('glare')) throw new Error('glare: ' + JSON.stringify(a));
}
function t_blur_lowers_sharpness():void {
  const sharp = assessFrame(stripes(210, 40, 5), W, H).blurVar;
  const blur = assessFrame(boxBlur(stripes(210, 40, 5), 4), W, H).blurVar;
  if (!(sharp > blur)) throw new Error(`blur should lower blurVar: sharp ${sharp} blur ${blur}`);
}
function t_guidance_strings():void {
  if (guidanceFor(assessFrame(flat(20), W, H)) !== 'Too dark — add more light') throw new Error('guidance');
  if (!guidanceFor({ brightness: 0, glareFrac: 0, blurVar: 0, contentFrac: 0, ready: true, reasons: [] })
      .includes('ready')) throw new Error('ready guidance');
}

describe('frameQuality', () => {
  it('ready on a sharp contrasty framed display', t_ready_sharp_contrasty);
  it('flags too dark', t_too_dark);
  it('flags too bright/glare', t_too_bright);
  it('flags no display on a flat frame', t_no_display_flat);
  it('flags glare on a saturated patch', t_glare_patch);
  it('blur lowers the sharpness metric', t_blur_lowers_sharpness);
  it('produces guidance strings', t_guidance_strings);
});
