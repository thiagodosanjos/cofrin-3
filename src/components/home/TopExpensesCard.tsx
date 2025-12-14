import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../contexts/themeContext';
import { spacing, borderRadius, getShadow } from '../../theme';
import { formatCurrencyBRL } from '../../utils/format';
import { useExpensesByCategory } from '../../hooks/useFirebaseTransactions';

interface Props { 
  onDetailsPress?: () => void;
}

// Cores para as categorias
const CATEGORY_COLORS = [
  '#EF4444', // vermelho
  '#F97316', // laranja
  '#F59E0B', // amarelo
  '#84CC16', // verde limão
  '#22C55E', // verde
  '#14B8A6', // teal
  '#06B6D4', // cyan
  '#3B82F6', // azul
  '#8B5CF6', // roxo
  '#EC4899', // rosa
];

type TopCount = 3 | 5 | 10;

export default function TopExpensesCard({ onDetailsPress }: Props) {
  const { colors } = useAppTheme();
  const [topCount, setTopCount] = useState<TopCount>(5);
  
  // Mês atual
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  const { expenses, total, loading } = useExpensesByCategory(currentMonth, currentYear);

  // Top N categorias
  const topExpenses = expenses.slice(0, topCount);

  // Calcular porcentagem
  const getPercentage = (value: number) => {
    if (total === 0) return 0;
    return (value / total) * 100;
  };

  // Obter cor da categoria
  const getCategoryColor = (index: number) => {
    return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
  };

  // Alternar quantidade
  const cycleTopCount = () => {
    const options: TopCount[] = [3, 5, 10];
    const currentIndex = options.indexOf(topCount);
    const nextIndex = (currentIndex + 1) % options.length;
    setTopCount(options[nextIndex]);
  };

  // Nome do mês
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  return (
    <View style={[styles.card, { backgroundColor: colors.card }, getShadow(colors)]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleSection}>
          <Text style={[styles.title, { color: colors.text }]}>
            Maiores gastos
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {monthNames[currentMonth - 1]} {currentYear}
          </Text>
        </View>

        <View style={styles.headerRight}>
          {/* Seletor de quantidade */}
          <Pressable 
            onPress={cycleTopCount}
            style={[styles.topSelector, { backgroundColor: colors.primaryBg }]}
          >
            <Text style={[styles.topSelectorText, { color: colors.primary }]}>
              Top {topCount}
            </Text>
          </Pressable>

          <View style={[styles.iconContainer, { backgroundColor: colors.dangerBg }]}>
            <MaterialCommunityIcons 
              name="chart-pie" 
              size={20} 
              color={colors.expense} 
            />
          </View>
        </View>
      </View>

      {/* Conteúdo */}
      {loading ? (
        <View style={[styles.emptyContainer, { backgroundColor: colors.grayLight }]}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Carregando...
          </Text>
        </View>
      ) : topExpenses.length === 0 ? (
        <View style={[styles.emptyContainer, { backgroundColor: colors.grayLight }]}>
          <MaterialCommunityIcons 
            name="chart-donut" 
            size={48} 
            color={colors.border} 
          />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Sem gastos este mês
          </Text>
        </View>
      ) : (
        <>
          {/* Lista de categorias */}
          <View style={styles.categoriesList}>
            {topExpenses.map((expense, index) => {
              const percentage = getPercentage(expense.total);
              const color = getCategoryColor(index);
              
              return (
                <View key={expense.categoryId} style={styles.categoryItem}>
                  <View style={styles.categoryLeft}>
                    <View style={[styles.categoryIcon, { backgroundColor: color + '20' }]}>
                      <MaterialCommunityIcons 
                        name={expense.categoryIcon as any} 
                        size={16} 
                        color={color} 
                      />
                    </View>
                    <View style={styles.categoryInfo}>
                      <Text 
                        style={[styles.categoryName, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {expense.categoryName}
                      </Text>
                      <View style={styles.progressBarContainer}>
                        <View 
                          style={[
                            styles.progressBar, 
                            { backgroundColor: colors.border }
                          ]}
                        >
                          <View 
                            style={[
                              styles.progressFill, 
                              { 
                                backgroundColor: color,
                                width: `${percentage}%` 
                              }
                            ]} 
                          />
                        </View>
                        <Text style={[styles.percentageText, { color: colors.textMuted }]}>
                          {percentage.toFixed(0)}%
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Text style={[styles.categoryValue, { color: colors.expense }]}>
                    {formatCurrencyBRL(expense.total)}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Total */}
          <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.totalLabel, { color: colors.textMuted }]}>
              Total de gastos
            </Text>
            <Text style={[styles.totalValue, { color: colors.expense }]}>
              {formatCurrencyBRL(total)}
            </Text>
          </View>

          {/* Botão de detalhes */}
          <Pressable 
            onPress={onDetailsPress}
            style={({ pressed }) => [
              styles.detailsButton,
              { backgroundColor: colors.primaryBg },
              pressed && { opacity: 0.7 }
            ]}
          >
            <Text style={[styles.detailsButtonText, { color: colors.primary }]}>
              Ver relatório completo
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color={colors.primary} />
          </Pressable>
        </>
      )}
    </View>
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
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  titleSection: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  topSelector: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  topSelectorText: {
    fontSize: 12,
    fontWeight: '600',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
  },
  emptyText: {
    marginTop: spacing.sm,
    fontSize: 13,
  },
  categoriesList: {
    gap: spacing.sm,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  categoryName: {
    fontSize: 13,
    fontWeight: '500',
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: spacing.xs,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  percentageText: {
    fontSize: 10,
    width: 28,
    textAlign: 'right',
  },
  categoryValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    marginTop: spacing.md,
    borderTopWidth: 1,
  },
  totalLabel: {
    fontSize: 13,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    gap: 4,
  },
  detailsButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
