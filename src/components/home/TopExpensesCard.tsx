import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { palette, spacing, borderRadius } from '../../theme';

interface Props { 
  title?: string;
}

export default function TopExpensesCard({ title = 'Maiores gastos do mês atual' }: Props) {
  const theme = useTheme();

  return (
    <Card style={styles.card} mode="elevated">
      {/* Header */}
      <View style={styles.header}>
        <Text variant="titleMedium" style={styles.title}>{title}</Text>
        <View style={[styles.iconContainer, { backgroundColor: palette.dangerBg }]}>
          <MaterialCommunityIcons 
            name="chart-pie" 
            size={20} 
            color={palette.danger} 
          />
        </View>
      </View>

      {/* Chart placeholder */}
      <View style={styles.chartContainer}>
        <MaterialCommunityIcons 
          name="chart-donut" 
          size={64} 
          color={palette.grayLight} 
        />
        <Text variant="bodySmall" style={styles.placeholderText}>
          Sem dados suficientes
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontWeight: '600',
    color: palette.text,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartContainer: {
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.grayLight,
    borderRadius: borderRadius.md,
  },
  placeholderText: {
    color: palette.textMuted,
    marginTop: spacing.sm,
  },
});
