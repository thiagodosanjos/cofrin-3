import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../contexts/themeContext';
import { spacing, borderRadius, getShadow } from '../../theme';
import { formatCurrencyBRL } from '../../utils/format';

interface CategoryExpense {
  categoryId: string;
  categoryName: string;
  total: number;
  icon?: string;
  color?: string;
}

interface TopCategoryCardProps {
  expenses: CategoryExpense[];
  totalExpenses: number;
  onPress?: () => void;
}

export default function TopCategoryCard({ expenses, totalExpenses, onPress }: TopCategoryCardProps) {
  const { colors } = useAppTheme();

  if (!expenses || expenses.length === 0) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card }, getShadow(colors)]}>
        <Text style={[styles.title, { color: colors.text }]}>Onde você gastou</Text>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          Nenhuma despesa registrada este mês
        </Text>
      </View>
    );
  }

  // Pegar a categoria com maior gasto
  const topCategory = expenses[0];
  const percentage = totalExpenses > 0 ? (topCategory.total / totalExpenses) * 100 : 0;

  // Gerar insight baseado na proporção
  const getInsight = (): string => {
    if (percentage >= 50) {
      return `Mais da metade dos gastos foi em ${topCategory.categoryName}`;
    } else if (percentage >= 30) {
      return `${topCategory.categoryName} representa ${Math.round(percentage)}% dos gastos`;
    } else {
      return `Gastos distribuídos entre várias categorias`;
    }
  };

  return (
    <Pressable 
      style={[styles.card, { backgroundColor: colors.card }, getShadow(colors)]}
      onPress={onPress}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Onde você gastou</Text>
        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
      </View>

      {/* Top Category */}
      <View style={styles.categoryRow}>
        <View style={[styles.iconContainer, { backgroundColor: colors.primaryBg }]}>
          <MaterialCommunityIcons 
            name={(topCategory.icon || 'tag') as any} 
            size={20} 
            color={colors.primary} 
          />
        </View>
        <View style={styles.categoryInfo}>
          <Text style={[styles.categoryName, { color: colors.text }]}>
            {topCategory.categoryName}
          </Text>
          <Text style={[styles.categoryAmount, { color: colors.text }]}>
            {formatCurrencyBRL(topCategory.total)}
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <View 
          style={[
            styles.progressFill, 
            { 
              backgroundColor: colors.primary, 
              width: `${Math.min(percentage, 100)}%` 
            }
          ]} 
        />
      </View>

      {/* Insight */}
      <Text style={[styles.insight, { color: colors.textMuted }]}>
        {getInsight()}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    marginTop: spacing.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  categoryAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  insight: {
    fontSize: 13,
    lineHeight: 18,
  },
});
