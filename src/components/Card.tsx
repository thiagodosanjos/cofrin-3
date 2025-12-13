import React from 'react';
import { StyleSheet } from 'react-native';
import { Card as PaperCard, useTheme } from 'react-native-paper';
import { spacing, borderRadius, shadows } from '../theme';

interface CardProps {
  children: React.ReactNode;
  style?: any;
  mode?: 'elevated' | 'outlined' | 'contained';
}

export default function Card({ children, style, mode = 'elevated' }: CardProps) {
  const theme = useTheme();
  return (
    <PaperCard 
      mode={mode} 
      style={[
        styles.card, 
        { backgroundColor: theme.colors.surface }, 
        style
      ]}
    >
      {children}
    </PaperCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    ...shadows.md,
  },
});
