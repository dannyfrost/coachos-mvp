/**
 * ISOLATED camera-guidance PROTOTYPE (Workstream B). Reachable only at the
 * unlinked route /camera-lab — it is NOT wired into the weight-logging flow and
 * writes NO daily_logs / RPC. It shows a live preview, an alignment overlay,
 * image-quality guidance (framing / lighting / glare / blur) and a ready
 * indicator, then demonstrates handoff to the EXISTING signed-upload flow by
 * uploading one throwaway `lab_` object. It does NOT read the weight, and a
 * "ready" frame does NOT guarantee the display is OCR-readable.
 *
 * Requires a dev/preview build (expo-camera is a native module; added to
 * app.json plugins). Tune thresholds in lib/frameQuality.ts.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { Skia } from '@shopify/react-native-skia';
import { createMobileSupabaseClient } from '@coaching/supabase/mobile';
import { assessFrame, guidanceFor, type FrameAssessment } from '../lib/frameQuality';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
const ANALYZE_MS = 420;            // ~2.4 analyses/sec — cheap for low-end Unisoc
const ANALYZE_WIDTH = 160;         // downscale before pixel analysis

export default function CameraLab() {
  const [perm, requestPerm] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);
  const busy = useRef(false);
  const active = useRef(false);          // true only while the screen is focused
  const ready = useRef(false);
  const [focused, setFocused] = useState(false);
  const [assess, setAssess] = useState<FrameAssessment | null>(null);
  const [fps, setFps] = useState(0);
  const [status, setStatus] = useState('');
  const [uploading, setUploading] = useState(false);
  const last = useRef(Date.now());

  useEffect(() => { if (perm && !perm.granted) requestPerm(); }, [perm]);

  // Start analysis only while focused; on blur/exit stop the loop AND unmount
  // the camera (via `focused`) so hardware + quality work are released.
  useFocusEffect(useCallback(() => {
    active.current = true; setFocused(true);
    const id = setInterval(analyze, ANALYZE_MS);
    return () => {
      active.current = false;
      clearInterval(id);
      setFocused(false);
      setAssess(null);
    };
  }, []));

  async function analyze() {
    if (busy.current || !active.current || !camRef.current) return;
    busy.current = true;
    try {
      const pic = await camRef.current.takePictureAsync({ quality: 0.3, skipProcessing: true, shutterSound: false });
      if (!pic?.uri) return;
      const small = await ImageManipulator.manipulateAsync(
        pic.uri, [{ resize: { width: ANALYZE_WIDTH } }],
        { compress: 0.4, format: ImageManipulator.SaveFormat.JPEG }
      );
      const data = await Skia.Data.fromURI(small.uri);
      const img = Skia.Image.MakeImageFromEncoded(data);
      if (!img) return;
      const w = img.width(), h = img.height();
      const rgba = img.readPixels() as Uint8Array | Float32Array | null;
      if (!rgba) return;
      const gray = new Uint8Array(w * h);
      const f = rgba instanceof Float32Array ? 255 : 1;   // Float32 variant is 0..1
      for (let i = 0; i < w * h; i++) {
        const r = (rgba[i * 4] as number) * f, g = (rgba[i * 4 + 1] as number) * f, b = (rgba[i * 4 + 2] as number) * f;
        gray[i] = (0.299 * r + 0.587 * g + 0.114 * b) | 0;
      }
      if (!active.current) return;        // blurred mid-analysis -> drop result
      const a = assessFrame(gray, w, h);
      ready.current = a.ready;
      setAssess(a);
      const now = Date.now(); setFps(Math.round(1000 / Math.max(1, now - last.current))); last.current = now;
    } catch {
      // best-effort analysis; ignore transient camera/decoder errors
    } finally {
      busy.current = false;
    }
  }

  async function capture() {
    if (!camRef.current || uploading) return;
    setUploading(true); setStatus('Capturing…');
    try {
      const pic = await camRef.current.takePictureAsync({ quality: 0.7, skipProcessing: false });
      if (!pic?.uri) { setStatus('Capture failed'); return; }
      await demoHandoff(pic.uri, pic.width ?? 0, pic.height ?? 0);
    } catch (e) {
      setStatus('Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setUploading(false);
    }
  }

  // Demonstrates the EXISTING signed-upload flow with a throwaway lab_ object.
  // No daily_logs write, no RPC — production weight logging is untouched.
  async function demoHandoff(uri: string, w: number, h: number) {
    const supabase = createMobileSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) { setStatus(`Captured ${w}x${h}; no session — handoff skipped (dev)`); return; }
    const { data: clientRow } = await supabase.from('clients').select('coach_id').eq('id', session.user.id).single();
    if (!clientRow?.coach_id) { setStatus('Captured; not a client account — handoff skipped'); return; }
    const path = `${clientRow.coach_id}/${session.user.id}/lab_capture_${Date.now()}.jpeg`;
    const blob = await fetch(uri).then((r) => r.blob());
    setStatus('Uploading via existing signed-upload…');
    const urlRes = await fetch(`${API_BASE}/api/storage/signed-upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ path, content_type: 'image/jpeg', size: blob.size }),
    });
    if (!urlRes.ok) { setStatus(`signed-upload-url ${urlRes.status}`); return; }
    const { signed_url } = (await urlRes.json()) as { signed_url: string };
    const put = await fetch(signed_url, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
    setStatus(put.ok ? `Handoff OK — uploaded ${blob.size}B to ${path} (no weight logged)` : `PUT ${put.status}`);
  }

  if (!perm) return <Center><ActivityIndicator /></Center>;
  if (!perm.granted) return (
    <Center>
      <Text style={styles.txt}>Camera permission needed for the guidance lab.</Text>
      <TouchableOpacity style={styles.btn} onPress={requestPerm}><Text style={styles.btnTxt}>Grant</Text></TouchableOpacity>
    </Center>
  );

  const ok = assess?.ready ?? false;
  return (
    <View style={styles.fill}>
      {/* rendered only while focused -> leaving the screen unmounts it and
          releases the camera hardware */}
      {focused && <CameraView ref={camRef} style={styles.fill} facing="back" />}
      {/* alignment overlay matches CENTER_ROI (0.15,0.3,0.7,0.4) */}
      <View pointerEvents="none" style={styles.overlay}>
        <View style={[styles.target, { borderColor: ok ? '#2ecc71' : '#ffce54' }]} />
      </View>
      <View style={styles.hud} pointerEvents="none">
        <Text style={[styles.guidance, { color: ok ? '#2ecc71' : '#ffce54' }]}>
          {assess ? guidanceFor(assess) : 'Starting camera…'}
        </Text>
        {assess && (
          <Text style={styles.metrics}>
            blur {assess.blurVar.toFixed(0)} · light {assess.brightness.toFixed(0)} ·
            glare {(assess.glareFrac * 100).toFixed(1)}% · content {(assess.contentFrac * 100).toFixed(1)}% · ~{fps}fps
          </Text>
        )}
      </View>
      <View style={styles.bottom}>
        <Text style={styles.status}>{status}</Text>
        <TouchableOpacity
          style={[styles.capture, { backgroundColor: ok ? '#2ecc71' : '#777' }]}
          disabled={!ok || uploading}
          onPress={capture}
        >
          {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>{ok ? 'Capture' : 'Align to enable'}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <View style={[styles.fill, styles.center]}>{children}</View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  target: { position: 'absolute', left: '15%', top: '30%', width: '70%', height: '40%', borderWidth: 3, borderRadius: 10 },
  hud: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 30, left: 0, right: 0, alignItems: 'center' },
  guidance: { fontSize: 18, fontWeight: '700', backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  metrics: { marginTop: 6, color: '#ddd', fontSize: 12, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  bottom: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center' },
  status: { color: '#fff', marginBottom: 10, fontSize: 12, paddingHorizontal: 16, textAlign: 'center' },
  capture: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 30 },
  btn: { marginTop: 16, backgroundColor: '#00488d', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  txt: { color: '#fff', fontSize: 16, textAlign: 'center' },
});
