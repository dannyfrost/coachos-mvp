import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Theme, fontFamily, FieldLabel, useTheme } from '../lib/design-system';
import { IconCheck } from '../lib/icons';

type DailyLogSummary = {
  log_date: string;
};

type LoggingHeatmapProps = {
  logs: DailyLogSummary[];
};

export default function LoggingHeatmap({ logs }: LoggingHeatmapProps) {
  const T = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 is Sun, 1 is Mon...
  const diffToMon = (dayOfWeek + 6) % 7; // days since Mon
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMon);

  const weekDayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const logDateSet = new Set(logs.map((l) => l.log_date));

  const weekDays = weekDayLabels.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${day}`;
    const hasLog = logDateSet.has(dateStr);
    return { label, dateStr, hasLog };
  });

  const loggedDaysCount = weekDays.filter((d) => d.hasLog).length;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <FieldLabel style={styles.fieldLabel}>LOGGING CONSISTENCY</FieldLabel>
        <Text style={styles.countText}>{loggedDaysCount}/7 this week</Text>
      </View>

      <View style={styles.heatmapRow}>
        {weekDays.map((day, i) => (
          <View key={i} style={styles.dayCol}>
            <View
              style={[
                styles.square,
                day.hasLog ? styles.squareFilled : styles.squareEmpty,
              ]}
            >
              {day.hasLog && (
                <IconCheck size={11} color={T.onPrimary} strokeWidth={2.5} />
              )}
            </View>
            <Text style={styles.dayLabel}>{day.label}</Text>
          </View>
        ))}
      </View>
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
    alignItems: 'center',
    marginBottom: 12,
  },
  fieldLabel: {
    marginBottom: 0,
  },
  countText: {
    fontSize: 12,
    color: T.primary,
    fontFamily: fontFamily.bodyBold,
    fontWeight: '700',
  },
  heatmapRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dayCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  square: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  squareFilled: {
    backgroundColor: T.primary,
  },
  squareEmpty: {
    backgroundColor: T.surfaceLow,
  },
  dayLabel: {
    fontSize: 10,
    color: T.muted,
    fontFamily: fontFamily.bodySemiBold,
    fontWeight: '600',
  },
});
