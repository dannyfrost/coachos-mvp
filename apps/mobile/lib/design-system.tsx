import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export const T = {
  primary: '#00488d',
  primaryMid: '#005fb8',
  primaryLight: '#e8f1fb',
  surface: '#f7f9fb',
  surfaceLow: '#f2f4f6',
  surfaceHigh: '#eceef1',
  white: '#ffffff',
  onSurface: '#191c1e',
  onSurfaceVar: '#424752',
  muted: '#9ca3af',
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
} as const;

export const fontFamily = {
  headingBold: 'PublicSans_700Bold',
  headingExtraBold: 'PublicSans_800ExtraBold',
  bodyRegular: 'PublicSans_400Regular',
  bodyMedium: 'PublicSans_500Medium',
  bodySemiBold: 'PublicSans_600SemiBold',
  bodyBold: 'PublicSans_700Bold',
};

export const screenBackground: ViewStyle = {
  flex: 1,
  backgroundColor: '#fdf6ee', // peach base
};

export const screenWashColors: [string, string] = ['#fdf1e4', '#e8f1fb']; // peach -> blue sky

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

export const inputStyle: TextStyle = {
  backgroundColor: T.surfaceLow,
  borderWidth: 0,
  borderBottomWidth: 2,
  borderBottomColor: T.primary,
  borderTopLeftRadius: 8,
  borderTopRightRadius: 8,
  borderBottomLeftRadius: 0,
  borderBottomRightRadius: 0,
  paddingHorizontal: 12,
  paddingVertical: 11,
  fontSize: 15,
  fontFamily: fontFamily.bodyRegular,
  color: T.onSurface,
};

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
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

export function StatusWord({
  status,
  labelOverride,
  style,
}: {
  status: string;
  labelOverride?: string;
  style?: StyleProp<TextStyle>;
}) {
  const s = BADGE_MAP[status.toLowerCase()] || { text: T.muted, label: status };
  return (
    <Text
      style={[
        {
          fontFamily: fontFamily.bodySemiBold,
          fontWeight: '600',
          fontSize: 14,
          color: s.text,
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
  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        activeOpacity={0.8}
        style={[
          styles.btnWrapper,
          { opacity: disabled ? 0.5 : 1 },
          style,
        ]}
      >
        <LinearGradient
          colors={[T.primary, T.primaryMid]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.btnBase,
            small ? styles.btnSmall : styles.btnNormal,
          ]}
        >
          {typeof children === 'string' ? (
            <Text
              style={[
                styles.btnTextPrimary,
                small && styles.btnTextSmall,
                textStyle,
              ]}
            >
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
    secondary: { backgroundColor: T.surfaceHigh },
    ghost: { backgroundColor: 'transparent' },
    danger: { backgroundColor: T.redBg },
    success: { backgroundColor: T.successBg },
  };

  const variantTextStyleMap: Record<Exclude<BtnVariant, 'primary'>, TextStyle> = {
    secondary: { color: T.primary },
    ghost: { color: T.primary },
    danger: { color: T.red },
    success: { color: T.success },
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
        <Text
          style={[
            styles.btnText,
            variantTextStyleMap[variant],
            small && styles.btnTextSmall,
            textStyle,
          ]}
        >
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
  return <Text style={[styles.sectionLabel, style]}>{children}</Text>;
}

export function FieldLabel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[styles.fieldLabel, style]}>{children}</Text>;
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
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: T.primary,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text
        style={{
          color: T.white,
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    ...cardShadow,
  },
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
    color: T.white,
  },
  btnTextSmall: {
    fontSize: 13,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: fontFamily.bodyBold,
    fontWeight: '700',
    color: T.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 11,
    fontFamily: fontFamily.bodyBold,
    fontWeight: '700',
    color: T.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
});
