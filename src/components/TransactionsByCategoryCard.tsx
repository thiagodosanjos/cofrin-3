import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../contexts/themeContext';
import { spacing, borderRadius, getShadow } from '../theme';
import { formatCurrencyBRL } from '../utils/format';
import { useState, useMemo } from 'react';

interface CategoryData {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  total: number;
}

type FilterType = 'expense' | 'income';

interface Props {
  expenses?: CategoryData[];
  incomes?: CategoryData[];
  totalExpenses?: number;
  totalIncomes?: number;
  maxItems?: 3 | 5;
  showTitle?: boolean;
  initialFilter?: FilterType;
  showFilterToggle?: boolean;
}

export default function TransactionsByCategoryCard({ 
  expenses = [], 
  incomes = [],
  totalExpenses = 0,
  totalIncomes = 0,
  maxItems = 5,
  showTitle = true,
  initialFilter = 'expense',
  showFilterToggle = true,
}: Props) {
  const { colors } = useAppTheme();
  const navigation = useNavigation<any>();
  const [filter, setFilter] = useState<FilterType>(initialFilter);

  // Determinar dados baseado no filtro
  const { data, total, title, emptyMessage, iconColor, iconBg, valueColor } = useMemo(() => {
    if (filter === 'income') {
      return {
        data: incomes,
        total: totalIncomes,
        title: 'De onde veio seu dinheiro',
        emptyMessage: 'Nenhuma receita registrada neste mês',
        iconColor: colors.income,
        iconBg: colors.successBg || '#DCFCE7',
        valueColor: colors.income,
      };
    }
    
    // Default: expense
    return {
      data: expenses,
      total: totalExpenses,
      title: 'Onde você gastou',
      emptyMessage: 'Nenhum gasto registrado neste mês',
      iconColor: colors.expense,
      iconBg: colors.dangerBg,
      valueColor: colors.expense,
    };
  }, [filter, expenses, incomes, totalExpenses, totalIncomes, colors]);

  // Calcular percentual de cada categoria
  const dataWithPercentage = data.map(item => ({
    ...item,
    percentage: total > 0 ? (item.total / total) * 100 : 0
  }));

  // Top N categorias
  const topItems = dataWithPercentage.slice(0, maxItems);

  // Verificar se "Outros" representa mais de 50%
  const othersCategory = topItems.find(
    cat => cat.categoryName.toLowerCase() === 'outros'
  );
  const hasOthersAlert = othersCategory && othersCategory.percentage > 50;

  // Verificar se alguma categoria domina (>50%)
  const dominantCategory = topItems.find(cat => cat.percentage > 50);
  const hasDominantCategory = dominantCategory && dominantCategory.categoryName.toLowerCase() !== 'outros';

  // Filter toggle component
  const FilterToggle = () => (
    <View style={[styles.filterContainer, { backgroundColor: colors.grayLight }]}>
      <Pressable
        onPress={() => setFilter('expense')}
        style={[
          styles.filterButton,
          filter === 'expense' && { backgroundColor: colors.card }
        ]}
      >
        <MaterialCommunityIcons 
          name="arrow-down" 
          size={14} 
          color={filter === 'expense' ? colors.expense : colors.textMuted} 
        />
        <Text style={[
          styles.filterText,
          { color: filter === 'expense' ? colors.expense : colors.textMuted }
        ]}>
          Despesas
        </Text>
      </Pressable>
      
      <Pressable
        onPress={() => setFilter('income')}
        style={[
          styles.filterButton,
          filter === 'income' && { backgroundColor: colors.card }
        ]}
      >
        <MaterialCommunityIcons 
          name="arrow-up" 
          size={14} 
          color={filter === 'income' ? colors.income : colors.textMuted} 
        />
        <Text style={[
          styles.filterText,
          { color: filter === 'income' ? colors.income : colors.textMuted }
        ]}>
          Receitas
        </Text>
      </Pressable>
    </View>
  );

  // Se não há dados
  if (data.length === 0 || total === 0) {
    return (
      <View 
        style={[styles.card, { backgroundColor: colors.card }, getShadow(colors)]}
      >
        {showTitle && (
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
              <MaterialCommunityIcons name="chart-pie" size={24} color={iconColor} />
            </View>
            <View style={styles.titleContainer}>
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            </View>
            <Pressable
              onPress={() => navigation.navigate('CategoryDetails')}
              style={({ pressed }) => [
                styles.moreButton,
                { backgroundColor: colors.grayLight },
                pressed && { opacity: 0.7 }
              ]}
              hitSlop={8}
            >
              <MaterialCommunityIcons name="arrow-right" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        )}
        
        {showFilterToggle && <FilterToggle />}
        
        <View style={[styles.emptyState, { backgroundColor: colors.grayLight }]}>
          <MaterialCommunityIcons name="information" size={20} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {emptyMessage}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View 
      style={[styles.card, { backgroundColor: colors.card }, getShadow(colors)]}
    >
      {showTitle && (
        <View style={styles.header}>
          <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
            <MaterialCommunityIcons name="chart-pie" size={24} color={iconColor} />
          </View>
          <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {topItems.length} {topItems.length === 1 ? 'categoria principal' : 'principais categorias'}
            </Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate('CategoryDetails')}
            style={({ pressed }) => [
              styles.moreButton,
              { backgroundColor: colors.grayLight },
              pressed && { opacity: 0.7 }
            ]}
            hitSlop={8}
          >
            <MaterialCommunityIcons name="arrow-right" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      )}

      {showFilterToggle && <FilterToggle />}

      {/* Alerta: Outros > 50% */}
      {hasOthersAlert && filter === 'expense' && (
        <View style={[styles.alert, { backgroundColor: colors.warningBg || '#FEF3C7' }]}>
          <MaterialCommunityIcons 
            name="alert-circle" 
            size={18} 
            color="#D97706" 
          />
          <Text style={[styles.alertText, { color: '#92400E' }]}>
            Muitos gastos estão em "Outros". Classificar melhor ajuda a entender para onde seu dinheiro está indo.
          </Text>
        </View>
      )}

      {/* Destaque: Categoria dominante > 50% */}
      {hasDominantCategory && dominantCategory && (
        <View style={[styles.highlight, { backgroundColor: colors.primaryBg }]}>
          <MaterialCommunityIcons 
            name="information" 
            size={18} 
            color={colors.primary} 
          />
          <Text style={[styles.highlightText, { color: colors.primary }]}>
            Mais da metade {filter === 'income' ? 'das suas receitas' : filter === 'expense' ? 'dos seus gastos' : 'das movimentações'} foi em{' '}
            <Text style={{ fontWeight: '700' }}>{dominantCategory.categoryName}</Text>
          </Text>
        </View>
      )}

      {/* Lista de categorias */}
      <View style={styles.categoryList}>
        {topItems.map((item, index) => {
          const isOthers = item.categoryName.toLowerCase() === 'outros';
          const isDominant = item.percentage > 50;
          
          return (
            <View key={item.categoryId} style={styles.categoryItem}>
              {/* Lado esquerdo: Rank, ícone e nome */}
              <View style={styles.categoryLeft}>
                <View style={[
                  styles.categoryRank, 
                  { 
                    backgroundColor: isDominant && !isOthers
                      ? colors.primaryBg 
                      : colors.grayLight 
                  }
                ]}>
                  <Text style={[
                    styles.categoryRankText, 
                    { 
                      color: isDominant && !isOthers 
                        ? colors.primary 
                        : colors.textMuted 
                    }
                  ]}>
                    {index + 1}
                  </Text>
                </View>
                
                <View style={[
                  styles.categoryIconCircle,
                  { backgroundColor: colors.grayLight }
                ]}>
                  <MaterialCommunityIcons 
                    name={item.categoryIcon as any} 
                    size={18} 
                    color={colors.text} 
                  />
                </View>
                
                <View style={styles.categoryInfo}>
                  <Text style={[styles.categoryName, { color: colors.text }]}>
                    {item.categoryName}
                  </Text>
                  
                  {/* Barra de percentual */}
                  <View style={styles.barContainer}>
                    <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
                      <View 
                        style={[
                          styles.barFill, 
                          { 
                            width: `${Math.min(item.percentage, 100)}%`,
                            backgroundColor: isDominant && !isOthers
                              ? colors.primary
                              : isOthers && item.percentage > 50
                              ? colors.warning || '#F59E0B'
                              : valueColor
                          }
                        ]} 
                      />
                    </View>
                    <Text style={[styles.percentageText, { color: colors.textMuted }]}>
                      {item.percentage.toFixed(0)}%
                    </Text>
                  </View>
                </View>
              </View>

              {/* Lado direito: Valor */}
              <Text style={[styles.categoryValue, { color: valueColor }]}>
                {formatCurrencyBRL(item.total)}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Rodapé informativo */}
      {data.length > maxItems && (
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <Text style={[styles.footerText, { color: colors.textMuted }]}>
            +{data.length - maxItems} {data.length - maxItems === 1 ? 'outra categoria' : 'outras categorias'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  filterContainer: {
    flexDirection: 'row',
    borderRadius: borderRadius.md,
    padding: 4,
    marginBottom: spacing.md,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  alert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  alertText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  highlight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  highlightText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  categoryList: {
    gap: spacing.md,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  categoryRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryRankText: {
    fontSize: 12,
    fontWeight: '700',
  },
  categoryIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryInfo: {
    flex: 1,
    gap: 4,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '500',
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
    minWidth: 2,
  },
  percentageText: {
    fontSize: 11,
    fontWeight: '600',
    width: 32,
    textAlign: 'right',
  },
  categoryValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
  },
  emptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  emptyText: {
    fontSize: 13,
    flex: 1,
  },
  moreButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
