import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Chip, useTheme } from 'react-native-paper';

type Action = { key?: string | number; label: string; onPress?: () => void; icon?: string };

export default function QuickActions({ actions = [], onAction }: { actions?: Action[]; onAction?: (key: string | number) => void }) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      {actions.map((a, idx) => (
        <Chip
          key={a.key ?? idx}
          onPress={() => {
            if (typeof a.onPress === 'function') return a.onPress();
            if (onAction) return onAction(a.key ?? idx);
          }}
          icon={a.icon}
          style={[styles.chip, { backgroundColor: theme.colors.surface }]}
          accessibilityLabel={a.label}
        >
          {a.label}
        </Chip>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row' },
  chip: { marginRight: 8 },
});
