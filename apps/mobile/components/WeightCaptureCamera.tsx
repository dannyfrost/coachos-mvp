/**
 * Guided scale-photo capture for the weight flow. A live camera preview with
 * an alignment box, real-time frame-quality guidance (framing / lighting /
 * glare / blur) and a Capture button that enables only once the frame is
 * "ready". As a BONUS it runs on-device ML Kit on the live frames and shows a
 * soft "number seen" hint — advisory only: on-device OCR can't reliably read
 * seven-segment scale LCD/LED (it drops the sparse "7"), so it NEVER gates
 * Capture. The authoritative read is still the server-side vision call the
 * parent runs on the captured photo (see home.tsx runWeightOcr).
 *
 * Adapted from the /camera-lab prototype. Requires a dev/preview build
 * (expo-camera + skia are native). Tune thresholds in lib/frameQuality.ts.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { Skia } from '@shopify/react-native-skia';
import { recognizeText } from 'rn-mlkit-ocr';
import { assessFrame, guidanceFor, type FrameAssessment } from '../lib/frameQuality';
import { extractWeightCandidate } from '../lib/weightOcr';
import { Theme, useTheme } from '../lib/design-system';
import { selection } from '../lib/haptics';

const ANALYZE_MS = 500; // quality tick cadence
const OCR_EVERY = 3; // run the ML Kit hint every Nth quality tick (~1.5s)
const QUALITY_WIDTH = 160; // downscale for the cheap pixel analysis
const OCR_WIDTH = 720; // ML Kit needs more resolution than the quality pass

type Props = {
  visible: boolean;
  onCapture: (uri: string, width: number, height: number) => void;
  onClose: () => void;
};

export default function WeightCaptureCamera({ visible, onCapture, onClose }: Props) {
  const T = useTheme();
  const styles = makeStyles(T);
  const [perm, requestPerm] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);
  const busy = useRef(false);
  const active = useRef(false);
  const tick = useRef(0);
  const [assess, setAssess] = useState<FrameAssessment | null>(null);
  const [hint, setHint] = useState<number | null>(null);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    if (visible && perm && !perm.granted) requestPerm();
  }, [visible, perm]);

  // Run the analysis loop only while the modal is open.
  useEffect(() => {
    if (!visible) return;
    active.current = true;
    tick.current = 0;
    const id = setInterval(analyze, ANALYZE_MS);
    return () => {
      active.current = false;
      clearInterval(id);
      setAssess(null);
      setHint(null);
    };
  }, [visible]);

  const analyze = useCallback(async () => {
    if (busy.current || !active.current || !camRef.current) return;
    busy.current = true;
    const doOcr = tick.current % OCR_EVERY === 0;
    tick.current++;
    try {
      const pic = await camRef.current.takePictureAsync({
        quality: doOcr ? 0.5 : 0.3,
        skipProcessing: true,
        shutterSound: false,
      });
      if (!pic?.uri) return;

      // Quality pass: grayscale the ROI-sized downscale and assess.
      const small = await ImageManipulator.manipulateAsync(
        pic.uri,
        [{ resize: { width: QUALITY_WIDTH } }],
        { compress: 0.4, format: ImageManipulator.SaveFormat.JPEG }
      );
      const data = await Skia.Data.fromURI(small.uri);
      const img = Skia.Image.MakeImageFromEncoded(data);
      if (img) {
        const w = img.width();
        const h = img.height();
        const rgba = img.readPixels() as Uint8Array | Float32Array | null;
        if (rgba) {
          const gray = new Uint8Array(w * h);
          const f = rgba instanceof Float32Array ? 255 : 1;
          for (let i = 0; i < w * h; i++) {
            const r = (rgba[i * 4] as number) * f;
            const g = (rgba[i * 4 + 1] as number) * f;
            const b = (rgba[i * 4 + 2] as number) * f;
            gray[i] = (0.299 * r + 0.587 * g + 0.114 * b) | 0;
          }
          if (active.current) setAssess(assessFrame(gray, w, h));
        }
      }

      // Advisory ML Kit hint (throttled). Best-effort; failure leaves the
      // last hint in place rather than flickering it away.
      if (doOcr) {
        try {
          const big = await ImageManipulator.manipulateAsync(
            pic.uri,
            [{ resize: { width: OCR_WIDTH } }],
            { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
          );
          const ocr = await recognizeText(big.uri, 'latin');
          const value = extractWeightCandidate(ocr);
          if (active.current && value !== null) setHint(value);
        } catch {
          // ignore transient OCR errors
        }
      }
    } catch {
      // best-effort; ignore transient camera/decoder errors
    } finally {
      busy.current = false;
    }
  }, []);

  async function capture() {
    if (!camRef.current || capturing) return;
    setCapturing(true);
    try {
      const pic = await camRef.current.takePictureAsync({
        quality: 0.7,
        skipProcessing: false,
      });
      if (pic?.uri) {
        // Crop to the alignment ROI (CENTER_ROI {0.15,0.3,0.7,0.4} in frameQuality,
        // image space) with a 5% pad on each side, so the server OCR gets the
        // display instead of the whole room — the box the user aligned to now
        // actually bounds what's sent. Pad guards slight misframing from clipping a
        // digit. Fall back to the full frame if crop fails.
        let uri = pic.uri;
        let w = pic.width ?? 0;
        let h = pic.height ?? 0;
        if (w > 0 && h > 0) {
          try {
            const cropped = await ImageManipulator.manipulateAsync(
              pic.uri,
              [{ crop: {
                originX: Math.round(0.10 * w),
                originY: Math.round(0.25 * h),
                width: Math.round(0.80 * w),
                height: Math.round(0.50 * h),
              } }],
              { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
            );
            uri = cropped.uri;
            w = cropped.width;
            h = cropped.height;
          } catch {
            // keep full frame
          }
        }
        selection();
        onCapture(uri, w, h);
      }
    } catch {
      // swallow — user can simply press Capture again
    } finally {
      setCapturing(false);
    }
  }

  const ok = assess?.ready ?? false;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.fill}>
        {!perm || !perm.granted ? (
          <View style={styles.center}>
            <Text style={styles.msg}>
              {perm ? 'Camera access is needed to photograph your scale.' : 'Starting camera…'}
            </Text>
            {perm && !perm.granted && (
              <TouchableOpacity style={styles.grant} onPress={requestPerm}>
                <Text style={styles.grantTxt}>Grant access</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} style={styles.closeText}>
              <Text style={styles.closeTextTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {visible && <CameraView ref={camRef} style={styles.fill} facing="back" />}

            {/* Alignment box — matches CENTER_ROI (0.15,0.3,0.7,0.4). */}
            <View pointerEvents="none" style={styles.overlay}>
              <View style={[styles.target, { borderColor: ok ? T.success : T.white }]} />
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close camera"
            >
              <Text style={styles.closeBtnTxt}>✕</Text>
            </TouchableOpacity>

            <View style={styles.hud} pointerEvents="none">
              <Text style={[styles.guidance, { color: ok ? T.success : T.white }]}>
                {assess ? guidanceFor(assess) : 'Point the camera at your scale'}
              </Text>
              {hint !== null && (
                <Text style={styles.hintText}>Looks like {hint} kg — capture to confirm</Text>
              )}
            </View>

            <View style={styles.bottom}>
              <TouchableOpacity
                style={[styles.capture, { backgroundColor: ok ? T.success : T.muted }]}
                disabled={!ok || capturing}
                onPress={capture}
                accessibilityRole="button"
                accessibilityLabel={ok ? 'Capture scale photo' : 'Align the scale to enable capture'}
              >
                {capturing ? (
                  <ActivityIndicator color={T.onPrimary} />
                ) : (
                  <Text style={[styles.captureTxt, { color: T.onPrimary }]}>
                    {ok ? 'Capture' : 'Align to enable'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const makeStyles = (T: Theme) =>
  StyleSheet.create({
    fill: { flex: 1, backgroundColor: '#000' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: T.screenBg },
    msg: { color: T.onSurface, fontSize: 16, textAlign: 'center' },
    grant: { marginTop: 16, backgroundColor: T.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
    grantTxt: { color: T.onPrimary, fontWeight: '700', fontSize: 16 },
    closeText: { marginTop: 16 },
    closeTextTxt: { color: T.muted, fontSize: 15 },
    overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    target: { position: 'absolute', left: '15%', top: '30%', width: '70%', height: '40%', borderWidth: 3, borderRadius: 12 },
    closeBtn: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 56 : 28,
      right: 20,
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    closeBtnTxt: { color: '#fff', fontSize: 18, fontWeight: '700' },
    hud: { position: 'absolute', top: Platform.OS === 'ios' ? 64 : 36, left: 0, right: 0, alignItems: 'center' },
    guidance: {
      fontSize: 17,
      fontWeight: '700',
      backgroundColor: 'rgba(0,0,0,0.5)',
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 10,
      overflow: 'hidden',
      textAlign: 'center',
    },
    hintText: {
      marginTop: 8,
      color: '#fff',
      fontSize: 14,
      backgroundColor: 'rgba(0,0,0,0.45)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      overflow: 'hidden',
    },
    bottom: { position: 'absolute', bottom: 48, left: 0, right: 0, alignItems: 'center' },
    capture: { paddingHorizontal: 40, paddingVertical: 15, borderRadius: 30, minWidth: 180, alignItems: 'center' },
    captureTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  });
