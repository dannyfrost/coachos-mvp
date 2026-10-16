import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Theme, fontFamily, FieldLabel, useTheme } from '../lib/design-system';
import { fmtDateShort } from '../lib/stats';

type WeightPoint = {
  date: string;
  value: number | null;
};

type WeightTrendChartProps = {
  points: WeightPoint[];
};

export default function WeightTrendChart({ points }: WeightTrendChartProps) {
  const T = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const validPoints = points.filter(
    (p): p is { date: string; value: number } => p.value !== null
  );

  if (validPoints.length === 0) {
    return (
      <View style={styles.container}>
        <FieldLabel>WEIGHT TREND</FieldLabel>
        <Text style={styles.emptyText}>No weight logs in this period.</Text>
      </View>
    );
  }

  const values = validPoints.map((p) => p.value);
  const firstWeight = validPoints[0].value;
  const lastWeight = validPoints[validPoints.length - 1].value;
  const delta = lastWeight - firstWeight;

  let deltaText = '0.0 kg';
  let deltaColor: string = T.muted;
  if (validPoints.length > 1) {
    if (delta < 0) {
      deltaText = `−${Math.abs(delta).toFixed(1)} kg`;
      deltaColor = T.successMid;
    } else if (delta > 0) {
      deltaText = `+${delta.toFixed(1)} kg`;
      deltaColor = T.redMid;
    } else {
      deltaText = '0.0 kg';
      deltaColor = T.muted;
    }
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  const W = 320;
  const H = 110;
  const pad = 14;

  const pts = validPoints.map((p, i) => ({
    x:
      validPoints.length === 1
        ? W / 2
        : pad + (i / (validPoints.length - 1)) * (W - pad * 2),
    y: pad + ((max - p.value) / range) * (H - pad * 2),
  }));

  const tension = 0.3;
  let path = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  if (pts.length > 1) {
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;
      path += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
    }
  }

  const last = pts[pts.length - 1];
  const first = pts[0];
  const areaPath =
    pts.length > 1
      ? `${path} L${last.x.toFixed(2)},${H} L${first.x.toFixed(2)},${H} Z`
      : '';

  const startDateLabel = fmtDateShort(validPoints[0].date);
  const endDateLabel = fmtDateShort(validPoints[validPoints.length - 1].date);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <FieldLabel style={styles.fieldLabel}>WEIGHT TREND</FieldLabel>
          <View style={styles.valueRow}>
            <Text style={styles.currentVal}>{lastWeight.toFixed(1)}</Text>
            <Text style={styles.unitText}>kg</Text>
            {validPoints.length > 1 && (
              <Text style={[styles.deltaText, { color: deltaColor }]}>
                {deltaText}
              </Text>
            )}
          </View>
        </View>
      </View>

      <View style={styles.svgWrapper}>
        <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
          <Defs>
            <LinearGradient id="weightAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={T.primary} stopOpacity={0.18} />
              <Stop offset="100%" stopColor={T.primary} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {areaPath ? <Path d={areaPath} fill="url(#weightAreaGrad)" /> : null}
          <Path
            d={path}
            fill="none"
            stroke={T.primary}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx={last.x} cy={last.y} r={5} fill={T.primary} />
          <Circle cx={last.x} cy={last.y} r={3} fill={T.surface} />
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

const makeStyles = (T: Theme) =>
  StyleSheet.create({
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
  unitText: {
    fontSize: 13,
    color: T.muted,
    fontFamily: fontFamily.bodyRegular,
  },
  deltaText: {
    fontSize: 13,
    fontFamily: fontFamily.bodyBold,
    fontWeight: '700',
  },
  svgWrapper: {
    width: '100%',
    height: 110,
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
