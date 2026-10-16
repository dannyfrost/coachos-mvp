import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
  Platform,
  useColorScheme,
  AccessibilityInfo,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

// ─────────────────────────────────────────────────────────────────────────
// Theme tokens
//
// Every screen/component reads colors through `useTheme()`, which returns the
// light or dark token set based on the OS appearance (plus the two a11y flags
// below). The flat `T` export is kept as a static LIGHT alias so module-scope
// code and any not-yet-migrated file still resolves — screens shadow it with a
// local `const T = useTheme()`.
//
// Contrast figures below are vs the token's own surface, checked against the
// HIG thresholds (4.5:1 for text ≤17pt, 3:1 for ≥18pt/bold).
// ─────────────────────────────────────────────────────────────────────────

export type ThemeTokens = {
  primary: string;
  primaryMid: string;
  primaryLight: string;
  onPrimary: string;
  surface: string;
  surfaceLow: string;
  surfaceHigh: string;
  white: string;
  onSurface: string;
  onSurfaceVar: string;
  muted: string;
  border: string;
  success: string;
  successBg: string;
  successMid: string;
  amber: string;
  amberBg: string;
  amberMid: string;
  red: string;
  redBg: string;
  redMid: string;
  blue: string;
  blueBg: string;
  // Retheme additions
  screenBg: string;
  washColors: [string, string];
  cardFill: string;
  cardBorder: string;
  inputBg: string;
  // Functional-layer glass (tab bar, bars, sheets) — see GlassSurface
  glassFill: string;
  glassBorder: string;
  glassSolid: string;
  glassTint: 'light' | 'dark';
};

export type Theme = ThemeTokens & {
  scheme: 'light' | 'dark';
  reduceTransparency: boolean;
  reduceMotion: boolean;
};

export const lightTheme: ThemeTokens = {
  primary: '#00488d',
  primaryMid: '#005fb8',
  primaryLight: '#e8f1fb',
  onPrimary: '#ffffff', // on #00488d → 8.6:1
  surface: '#f7f9fb',
  surfaceLow: '#f2f4f6',
  surfaceHigh: '#eceef1',
  white: '#ffffff',
  onSurface: '#191c1e', // on surface → 15:1
  onSurfaceVar: '#424752', // on surface → 9:1
  muted: '#6b7280', // bumped from #9ca3af (2.6:1, failed) → on white 4.8:1
  border: 'rgba(25,28,30,0.07)',
  success: '#065f46',
  successBg: '#d1fae5',
  successMid: '#10b981',
  amber: '#92400e',
  amberBg: '#fef3c7',
  amberMid: '#f59e0b',
  red: '#991b1b',
  redBg: '#fde8e8',
  redMid: '#ef4444',
  blue: '#1e40af',
  blueBg: '#dbeafe',
  screenBg: '#fdf6ee', // peach base
  washColors: ['#fdf1e4', '#e8f1fb'], // peach → blue sky
  cardFill: 'rgba(255,255,255,0.72)',
  cardBorder: 'rgba(255,255,255,0.5)',
  inputBg: '#f2f4f6',
  glassFill: 'rgba(255,255,255,0.72)',
  glassBorder: 'rgba(255,255,255,0.55)',
  glassSolid: '#f4f7fa',
  glassTint: 'light',
};

export const darkTheme: ThemeTokens = {
  primary: '#5ea3e6', // accent text/icon, on #12161c → 6.4:1 (brand #00488d fails on dark)
  primaryMid: '#4a90d9', // gradient end for the primary button
  primaryLight: '#132436',
  onPrimary: '#06243f', // text on a #5ea3e6 fill → 6.5:1
  surface: '#12161c',
  surfaceLow: '#1a1f27',
  surfaceHigh: '#232a34',
  white: '#ffffff', // kept: text on saturated fills, badge text
  onSurface: '#e6e9ec', // on surface → 13:1
  onSurfaceVar: '#aab2bd', // on surface → 7.5:1
  muted: '#8b94a1', // on surface → 5.2:1
  border: 'rgba(255,255,255,0.12)',
  success: '#4ade80',
  successBg: 'rgba(16,185,129,0.16)',
  successMid: '#34d399',
  amber: '#fbbf24',
  amberBg: 'rgba(245,158,11,0.16)',
  amberMid: '#fbbf24',
  red: '#f87171',
  redBg: 'rgba(239,68,68,0.16)',
  redMid: '#f87171',
  blue: '#93c5fd',
  blueBg: 'rgba(59,130,246,0.16)',
  screenBg: '#0e1116',
  washColors: ['#161020', '#0b1726'], // warm → cool, barely-there over near-black
  cardFill: 'rgba(30,37,47,0.72)',
  cardBorder: 'rgba(255,255,255,0.08)',
  inputBg: '#1a1f27',
  glassFill: 'rgba(22,28,36,0.6)',
  glassBorder: 'rgba(255,255,255,0.10)',
  glassSolid: '#1b222c',
  glassTint: 'dark',
};

// Static light alias (back-compat + module scope). Screens shadow this with a
// local `const T = useTheme()`.
export const T = lightTheme;

/**
 * Current theme for the component. Re-renders on OS appearance change and on
 * Reduce Transparency / Reduce Motion toggles (iOS; both default false and
 * no-op on Android, where those settings aren't exposed the same way).
 */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  const [reduceTransparency, setReduceTransparency] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceTransparencyEnabled?.()
      .then((v) => mounted && setReduceTransparency(!!v))
      .catch(() => {});
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => mounted && setReduceMotion(!!v))
      .catch(() => {});
    const t = AccessibilityInfo.addEventListener?.(
      'reduceTransparencyChanged',
      (v: boolean) => setReduceTransparency(!!v)
    );
    const m = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) =>
      setReduceMotion(!!v)
    );
    return () => {
      mounted = false;
      t?.remove?.();
      m?.remove?.();
    };
  }, []);

  const base = scheme === 'dark' ? darkTheme : lightTheme;
  return useMemo(
    () => ({ ...base, scheme: scheme === 'dark' ? 'dark' : 'light', reduceTransparency, reduceMotion }),
    [base, scheme, reduceTransparency, reduceMotion]
  );
}

export const fontFamily = {
  headingBold: 'PublicSans_700Bold',
  headingExtraBold: 'PublicSans_800ExtraBold',
  bodyRegular: 'PublicSans_400Regular',
  bodyMedium: 'PublicSans_500Medium',
  bodySemiBold: 'PublicSans_600SemiBold',
  bodyBold: 'PublicSans_700Bold',
};

// Back-compat light statics. Migrated screens use T.screenBg / T.washColors.
export const screenBackground: ViewStyle = {
  flex: 1,
  backgroundColor: lightTheme.screenBg,
};
export const screenWashColors: [string, string] = lightTheme.washColors;

// Bottom padding every scrollable client screen adds to its outermost
// content style so scroll content clears the floating capsule tab bar
// (~64px tall, floated `insets.bottom + 16` above the screen edge — see
// (client)/_layout.tsx) plus breathing room for the largest expected
// safe-area inset.
export const TAB_BAR_CLEARANCE = 140;

export const cardShadow = Platform.select({
  ios: {
    shadowColor: '#191c1e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  android: { elevation: 3 },
  default: {},
});

// Card's own shadow: no `elevation` on Android. Android's native elevation
// shadow draws beneath the view's alpha-blended pixels, so combined with
// Card's translucent (rgba) fill it reads as a muddy gray halo rather than
// a clean shadow — a real Android-only rendering artifact, not something
// opacity tuning fixes. iOS's shadow renders as an external drop shadow and
// doesn't have this problem. The card's existing 1px border still defines
// its edge on Android without elevation.
export const translucentCardShadow = Platform.select({
  ios: {
    shadowColor: '#191c1e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  default: {},
});

// Theme-aware input style factory. `inputStyle` stays exported as a light
// static for back-compat; migrated call sites use inputStyleFor(T).
export function inputStyleFor(t: ThemeTokens): TextStyle {
  return {
    backgroundColor: t.inputBg,
    borderWidth: 0,
    borderBottomWidth: 2,
    borderBottomColor: t.primary,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: fontFamily.bodyRegular,
    color: t.onSurface,
  };
}
export const inputStyle: TextStyle = inputStyleFor(lightTheme);

/**
 * Content-layer panel. Translucent *color* fill over the screen wash — NOT a
 * blur surface. Per `liquid-glass.md › Review checklist #1`, glass belongs
 * only on the functional layer (see GlassSurface); content cards must not use
 * it. Theme-aware fill + border.
 */
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.cardFill,
          borderRadius: 24,
          padding: 16,
          borderWidth: 1,
          borderColor: t.cardBorder,
          ...translucentCardShadow,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * Functional-layer glass: tab bar, floating bars, sheets. Real backdrop blur
 * on iOS (expo-blur BlurView); an opaque lightly-tinted surface on Android and
 * whenever Reduce Transparency is on — Android blur is costly/inconsistent and
 * its design language doesn't use glass (`liquid-glass.md › React Native`).
 */
export function GlassSurface({
  children,
  style,
  radius = 24,
  intensity = 28,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  intensity?: number;
}) {
  const t = useTheme();
  const useBlur = Platform.OS === 'ios' && !t.reduceTransparency;
  if (!useBlur) {
    return (
      <View
        style={[
          { borderRadius: radius, overflow: 'hidden', backgroundColor: t.glassSolid, borderWidth: 1, borderColor: t.glassBorder },
          style,
        ]}
      >
        {children}
      </View>
    );
  }
  return (
    <BlurView
      intensity={intensity}
      tint={t.glassTint}
      style={[{ borderRadius: radius, overflow: 'hidden', borderWidth: 1, borderColor: t.glassBorder }, style]}
    >
      <View style={[StyleSheet.absoluteFill, { backgroundColor: t.glassFill }]} pointerEvents="none" />
      {children}
    </BlurView>
  );
}

export const BADGE_MAP: Record<string, { bg: string; text: string; label: string }> = {
  green: { bg: T.successBg, text: T.success, label: 'On Track' },
  yellow: { bg: T.amberBg, text: T.amber, label: 'Needs Attention' },
  red: { bg: T.redBg, text: T.red, label: 'At Risk' },
  paused: { bg: '#f3f4f6', text: T.muted, label: 'Paused' },
  active: { bg: T.successBg, text: T.success, label: 'Active' },
  pending: { bg: T.blueBg, text: T.blue, label: 'Pending' },
  suspended: { bg: T.redBg, text: T.red, label: 'Suspended' },
  banned: { bg: T.redBg, text: T.red, label: 'Banned' },
  deactivated: { bg: '#f3f4f6', text: T.muted, label: 'Deactivated' },
  expired: { bg: T.redBg, text: T.red, label: 'Expired' },
  overdue: { bg: T.amberBg, text: T.amber, label: 'Overdue' },
  meal: { bg: '#f0fdf4', text: '#166534', label: 'Meal' },
  workout: { bg: T.blueBg, text: T.blue, label: 'Workout' },
  message_sent: { bg: T.amberBg, text: T.amber, label: 'Message Sent' },
  escalated_to_coach: { bg: T.redBg, text: T.red, label: 'Escalated' },
  resolved: { bg: T.successBg, text: T.success, label: 'Resolved' },
  '24h': { bg: T.amberBg, text: T.amber, label: '24h' },
  '48h': { bg: T.amberBg, text: T.amber, label: '48h' },
  '72h': { bg: T.redBg, text: T.red, label: '72h' },
};

// Maps a status key to a theme color role, so the word stays legible in both
// appearances (BADGE_MAP's literal `text` colors are tuned for light only).
const STATUS_ROLE: Record<string, keyof ThemeTokens> = {
  green: 'success',
  active: 'success',
  resolved: 'success',
  yellow: 'amber',
  overdue: 'amber',
  message_sent: 'amber',
  '24h': 'amber',
  '48h': 'amber',
  red: 'red',
  suspended: 'red',
  banned: 'red',
  expired: 'red',
  escalated_to_coach: 'red',
  '72h': 'red',
  pending: 'blue',
  workout: 'blue',
  paused: 'muted',
  deactivated: 'muted',
};

export function StatusWord({
  status,
  labelOverride,
  style,
}: {
  status: string;
  labelOverride?: string;
  style?: StyleProp<TextStyle>;
}) {
  const t = useTheme();
  const key = status.toLowerCase();
  const s = BADGE_MAP[key] || { text: t.muted, label: status };
  const role = STATUS_ROLE[key];
  const color = role ? (t[role] as string) : t.muted;
  return (
    <Text
      style={[
        {
          fontFamily: fontFamily.bodySemiBold,
          fontWeight: '600',
          fontSize: 14,
          color,
          textDecorationLine: 'underline',
        },
        style,
      ]}
    >
      {labelOverride ?? s.label}
    </Text>
  );
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

export function Btn({
  children,
  variant = 'primary',
  onPress,
  disabled,
  small,
  style,
  textStyle,
  accessibilityLabel,
  accessibilityRole = 'button',
}: {
  children: React.ReactNode;
  variant?: BtnVariant;
  onPress?: () => void;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: 'button';
}) {
  const t = useTheme();
  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        activeOpacity={0.8}
        style={[styles.btnWrapper, { opacity: disabled ? 0.5 : 1 }, style]}
      >
        <LinearGradient
          colors={[t.primary, t.primaryMid]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.btnBase, small ? styles.btnSmall : styles.btnNormal]}
        >
          {typeof children === 'string' ? (
            <Text style={[styles.btnTextPrimary, { color: t.onPrimary }, small && styles.btnTextSmall, textStyle]}>
              {children}
            </Text>
          ) : (
            children
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  const variantStyleMap: Record<Exclude<BtnVariant, 'primary'>, ViewStyle> = {
    secondary: { backgroundColor: t.surfaceHigh },
    ghost: { backgroundColor: 'transparent' },
    danger: { backgroundColor: t.redBg },
    success: { backgroundColor: t.successBg },
  };

  const variantTextStyleMap: Record<Exclude<BtnVariant, 'primary'>, TextStyle> = {
    secondary: { color: t.primary },
    ghost: { color: t.primary },
    danger: { color: t.red },
    success: { color: t.success },
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      activeOpacity={0.8}
      style={[
        styles.btnBase,
        small ? styles.btnSmall : styles.btnNormal,
        variantStyleMap[variant],
        { opacity: disabled ? 0.5 : 1 },
        style,
      ]}
    >
      {typeof children === 'string' ? (
        <Text style={[styles.btnText, variantTextStyleMap[variant], small && styles.btnTextSmall, textStyle]}>
          {children}
        </Text>
      ) : (
        children
      )}
    </TouchableOpacity>
  );
}

export function SectionLabel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  const t = useTheme();
  return <Text style={[styles.sectionLabel, { color: t.muted }, style]}>{children}</Text>;
}

export function FieldLabel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  const t = useTheme();
  return <Text style={[styles.fieldLabel, { color: t.muted }, style]}>{children}</Text>;
}

export function Avatar({
  initials,
  size = 36,
  style,
}: {
  initials: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: t.primary,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text
        style={{
          color: t.onPrimary,
          fontFamily: fontFamily.headingBold,
          fontWeight: '700',
          fontSize: size * 0.36,
        }}
      >
        {initials}
      </Text>
    </View>
  );
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

// Only layout/typography constants that don't depend on the theme. Colors are
// injected inline from useTheme() at each call site above.
const styles = StyleSheet.create({
  btnWrapper: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  btnBase: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnNormal: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  btnSmall: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  btnText: {
    fontFamily: fontFamily.bodySemiBold,
    fontWeight: '600',
    fontSize: 15,
  },
  btnTextPrimary: {
    fontFamily: fontFamily.bodySemiBold,
    fontWeight: '600',
    fontSize: 15,
  },
  btnTextSmall: {
    fontSize: 13,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: fontFamily.bodyBold,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 11,
    fontFamily: fontFamily.bodyBold,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
});
