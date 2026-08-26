import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Polygon, Circle } from 'react-native-svg';

type LineChartProps = {
  points: { date: string; value: number | null }[];
  color: string;
};

export default function LineChart({ points, color }: LineChartProps) {
  const validPoints = points.filter(
    (p): p is { date: string; value: number } => p.value !== null
  );

  if (validPoints.length === 0) {
    return <Text style={styles.emptyText}>No data yet.</Text>;
  }

  const values = validPoints.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const svgWidth = 300;
  const svgHeight = 90;
  const paddingX = 12;
  const paddingTop = 10;
  const paddingBottom = 10;
  const plotWidth = svgWidth - paddingX * 2;
  const plotHeight = svgHeight - paddingTop - paddingBottom;

  const coords = validPoints.map((p, i) => {
    const x =
      validPoints.length === 1
        ? svgWidth / 2
        : paddingX + (i / (validPoints.length - 1)) * plotWidth;
    const y =
      paddingTop + plotHeight - ((p.value - min) / range) * plotHeight;
    return { x, y };
  });

  const polylinePoints = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const firstX = coords[0].x;
  const lastX = coords[coords.length - 1].x;
  const bottomY = svgHeight - 2;
  const polygonPoints = `${polylinePoints} ${lastX},${bottomY} ${firstX},${bottomY}`;
  const lastCoord = coords[coords.length - 1];

  const isDecimal = values.some((v) => !Number.isInteger(v));
  const formatVal = (v: number) => (isDecimal ? v.toFixed(1) : String(Math.round(v)));

  return (
    <View style={styles.container}>
      <View style={styles.labelsRow}>
        <Text style={styles.metaLabel}>Min: {formatVal(min)}</Text>
        <Text style={styles.metaLabel}>Max: {formatVal(max)}</Text>
      </View>
      <View style={styles.chartWrapper}>
        <Svg width="100%" height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
          <Polygon
            points={polygonPoints}
            fill={color}
            fillOpacity={0.1}
          />
          <Polyline
            points={polylinePoints}
            fill="none"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle
            cx={lastCoord.x}
            cy={lastCoord.y}
            r={4}
            fill={color}
          />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  metaLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
  },
  chartWrapper: {
    width: '100%',
    height: 90,
  },
  emptyText: {
    fontSize: 13,
    color: '#6b7280',
  },
});
