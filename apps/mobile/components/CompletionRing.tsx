import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import { T, fontFamily } from '../lib/design-system';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type CompletionRingProps = {
  done: number;
  total: number;
  size?: number;
};

export default function CompletionRing({
  done,
  total,
  size = 72,
}: CompletionRingProps) {
  const allDone = total > 0 && done === total;
  const strokeWidth = 5;
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;

  const anim = useRef(new Animated.Value(0)).current;
  const [dashOffset, setDashOffset] = useState(circumference);

  const targetPct = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;

  useEffect(() => {
    anim.setValue(0);
    const animation = Animated.timing(anim, {
      toValue: targetPct,
      duration: 650,
      useNativeDriver: false,
    });

    const listenerId = anim.addListener(({ value }) => {
      setDashOffset(circumference * (1 - value));
    });

    animation.start();

    return () => {
      anim.removeListener(listenerId);
    };
  }, [targetPct, circumference, anim]);

  const gradientId = `cring_${size}_${allDone ? 'done' : 'prog'}`;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop
              offset="0%"
              stopColor={allDone ? T.successMid : T.primaryMid}
            />
            <Stop
              offset="100%"
              stopColor={allDone ? T.success : T.primary}
            />
          </LinearGradient>
        </Defs>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          {/* Background track */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={T.surfaceHigh}
            strokeWidth={strokeWidth}
          />
          {/* Foreground progress */}
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
          />
        </G>
      </Svg>

      <View style={styles.centerTextContainer}>
        <Text
          style={[
            styles.countText,
            { color: allDone ? T.successMid : T.primary },
          ]}
        >
          {done}/{total}
        </Text>
        <Text style={styles.doneLabel}>
          {allDone ? 'ALL DONE' : 'DONE'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  centerTextContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontFamily: fontFamily.headingBold,
    fontWeight: '800',
    fontSize: 15,
    lineHeight: 18,
  },
  doneLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 8,
    fontWeight: '700',
    color: T.muted,
    marginTop: 1,
    letterSpacing: 0.5,
  },
});
