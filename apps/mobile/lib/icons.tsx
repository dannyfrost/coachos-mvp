import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Svg, { Path, Circle, Polyline, Line, Rect } from 'react-native-svg';
import { T } from './design-system';

export type IconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
};

export function IconScale({
  size = 20,
  color = 'currentColor',
  strokeWidth = 2,
}: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
      <Path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
      <Path d="M7 21h10" />
      <Path d="M12 3v18" />
      <Path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
    </Svg>
  );
}

export function IconSteps({
  size = 20,
  color = 'currentColor',
  strokeWidth = 2,
}: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </Svg>
  );
}

export function IconUtensils({
  size = 20,
  color = 'currentColor',
  strokeWidth = 2,
}: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <Path d="M7 2v20" />
      <Path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
    </Svg>
  );
}

export function IconCamera({
  size = 20,
  color = 'currentColor',
  strokeWidth = 2,
}: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <Circle cx="12" cy="13" r="3" />
    </Svg>
  );
}

export function IconChat({
  size = 20,
  color = 'currentColor',
  strokeWidth = 2,
}: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z" />
    </Svg>
  );
}

export function IconFlame({
  size = 20,
  color = 'currentColor',
  strokeWidth = 2,
}: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z" />
    </Svg>
  );
}

export function IconUser({
  size = 20,
  color = 'currentColor',
  strokeWidth = 2,
}: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </Svg>
  );
}

export function IconCalendar({
  size = 20,
  color = 'currentColor',
  strokeWidth = 2,
}: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M8 2v4" />
      <Path d="M16 2v4" />
      <Rect width="18" height="18" x="3" y="4" rx="2" />
      <Path d="M3 10h18" />
    </Svg>
  );
}

export function IconCross({
  size = 20,
  color = 'currentColor',
  strokeWidth = 2,
}: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2c0 1.1.9 2 2 2h5v5c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2h-2z" />
    </Svg>
  );
}

export function IconCheck({
  size = 20,
  color = 'currentColor',
  strokeWidth = 2,
}: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Polyline points="20 6 9 17 4 12" />
    </Svg>
  );
}

export function IconDoubleCheck({
  size = 16,
  color = T.muted,
  strokeWidth = 1.5,
}: IconProps) {
  return (
    <Svg
      width={size}
      height={(size * 10) / 16}
      viewBox="0 0 16 10"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Polyline points="1,5 4,8 9,2" />
      <Polyline points="7,5 10,8 15,2" />
    </Svg>
  );
}

export function IconLock({
  size = 20,
  color = 'currentColor',
  strokeWidth = 2,
}: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Svg>
  );
}

export type IconKey =
  | 'scale'
  | 'steps'
  | 'utensils'
  | 'camera'
  | 'chat'
  | 'flame'
  | 'user'
  | 'calendar'
  | 'cross'
  | 'check'
  | 'lock';

const ICON_COMPONENTS: Record<IconKey, React.ComponentType<IconProps>> = {
  scale: IconScale,
  steps: IconSteps,
  utensils: IconUtensils,
  camera: IconCamera,
  chat: IconChat,
  flame: IconFlame,
  user: IconUser,
  calendar: IconCalendar,
  cross: IconCross,
  check: IconCheck,
  lock: IconLock,
};

export function Chip({
  iconKey,
  size = 14,
  bg = T.surfaceLow,
  color = T.primary,
  chipSize = 28,
  radius = 8,
  style,
}: {
  iconKey: IconKey;
  size?: number;
  bg?: string;
  color?: string;
  chipSize?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const Component = ICON_COMPONENTS[iconKey];
  if (!Component) return null;

  return (
    <View
      style={[
        styles.chip,
        {
          width: chipSize,
          height: chipSize,
          borderRadius: radius,
          backgroundColor: bg,
        },
        style,
      ]}
    >
      <Component size={size} color={color} strokeWidth={2} />
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
