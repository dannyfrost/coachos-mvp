import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import { T, fontFamily, FieldLabel } from '../lib/design-system';
import { fmtDateShort } from '../lib/stats';

type StepsPoint = {
  date: string;
  value: number | null;
};

type StepsBarChartProps = {
  points: StepsPoint[];
};

export default function StepsBarChart({ points }: StepsBarChartProps) {
  const validPoints = points.filter(
    (p): p is { date: string; value: number } => p.value !== null
  );

  if (validPoints.length === 0) {
    return (
      <View style={styles.container}>
        <FieldLabel>STEPS TREND</FieldLabel>
        <Text style={styles.emptyText}>No steps logs in this period.</Text>
      </View>
    );
  }

  const values = validPoints.map((p) => p.value);
  const latestSteps = validPoints[validPoints.length - 1].value;
  const avgSteps = Math.round(
    values.reduce((sum, v) => sum + v, 0) / values.length
  );

  const SB_W = 320;
  const SB_H = 90;
  const SB_PAD = 8;
  const SB_GAP = 4;
  const sbMax = Math.max(...values, 1);
  const count = validPoints.length;
  const sbBarW = (SB_W - SB_PAD * 2 - SB_GAP * (count - 1)) / count;

  const sbBars = validPoints.map((p, i) => {
    const h = Math.max(4, (p.value / sbMax) * (SB_H - SB_PAD * 2));
    return {
      x: SB_PAD + i * (sbBarW + SB_GAP),
      y: SB_H - SB_PAD - h,
      h,
      w: sbBarW,
    };
  });

  const startDateLabel = fmtDateShort(validPoints[0].date);
  const endDateLabel = fmtDateShort(validPoints[validPoints.length - 1].date);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <FieldLabel style={styles.fieldLabel}>STEPS TREND</FieldLabel>
          <View style={styles.valueRow}>
            <Text style={styles.currentVal}>{latestSteps.toLocaleString()}</Text>
            {validPoints.length > 1 && (
              <Text style={styles.avgText}>· avg {avgSteps.toLocaleString()}/day</Text>
            )}
          </View>
        </View>
      </View>

      <View style={styles.svgWrapper}>
        <Svg width="100%" height={SB_H} viewBox={`0 0 ${SB_W} ${SB_H}`}>
          <Defs>
            <LinearGradient id="stepsBarGrad" x1="0" y1="1" x2="0" y2="0">
              <Stop offset="0%" stopColor={T.primaryLight} />
              <Stop offset="100%" stopColor={T.primaryMid} />
            </LinearGradient>
          </Defs>
          {sbBars.map((b, i) => {
            const isLast = i === sbBars.length - 1;
            return (
              <Rect
                key={i}
                x={b.x}
                y={b.y}
                width={Math.max(2, b.w)}
                height={b.h}
                rx={Math.min(3, b.w / 2)}
                fill={isLast ? T.primary : 'url(#stepsBarGrad)'}
              />
            );
          })}
        </Svg>
      </View>

      {validPoints.length > 1 ? (
        <View style={styles.datesRow}>
          <Text style={styles.dateLabel}>{startDateLabel}</Text>
          <Text style={styles.dateLabel}>{endDateLabel}</Text>
        </View>
      ) : (
        <Text style={styles.singlePointHint}>
          {startDateLabel} · Log more days to see your trend
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  fieldLabel: {
    marginBottom: 2,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  currentVal: {
    fontFamily: fontFamily.headingExtraBold,
    fontWeight: '800',
    fontSize: 26,
    color: T.onSurface,
  },
  avgText: {
    fontSize: 12,
    color: T.muted,
    fontFamily: fontFamily.bodyRegular,
  },
  svgWrapper: {
    width: '100%',
    height: 90,
    marginTop: 4,
  },
  datesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  dateLabel: {
    fontSize: 10,
    color: T.muted,
    fontFamily: fontFamily.bodyRegular,
  },
  singlePointHint: {
    fontSize: 10,
    color: T.muted,
    fontFamily: fontFamily.bodyRegular,
    marginTop: 4,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: T.muted,
    fontFamily: fontFamily.bodyRegular,
    marginTop: 4,
  },
});
