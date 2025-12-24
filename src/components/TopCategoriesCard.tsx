import { View, StyleSheet, Pressable, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../contexts/themeContext';
import { formatCurrencyBRL } from '../utils/format';
import { useMemo } from 'react';

// ====================================================
// DESIGN TOKENS - Premium Financial App Style
// ====================================================
const COLORS = {
  // Card
  cardBackground: '#FFFFFF',
  
  // Header
  headerIconBg: '#EDE9FF',
  headerIconColor: '#6C4EFF',
  headerTitle: '#1F1F1F',
  
  // Expense card
  expenseBg: 'rgba(255, 159, 67, 0.14)',
  expenseAccent: '#FF9F43',
  
  // Income card
  incomeBg: 'rgba(46, 213, 115, 0.14)',
  incomeAccent: '#2ED573',
  
  // Text
  categoryText: '#2C2C2C',
  subtleText: '#6F6F6F',
  
  // Button
  buttonBg: '#6C4EFF',
  buttonText: '#FFFFFF',
};

const SHADOWS = {
  card: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOpacity: 0.08,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
    },
    android: {
      elevation: 6,
    },
  }),
  button: Platform.select({
    ios: {
      shadowColor: '#6C4EFF',
      shadowOpacity: 0.35,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
    },
    android: {
      elevation: 5,
    },
  }),
};

interface CategoryData {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  total: number;
}

interface Props {
  expenses?: CategoryData[];
  incomes?: CategoryData[];
  totalExpenses?: number;
  totalIncomes?: number;
}

export default function TopCategoriesCard({
  expenses = [],
  incomes = [],
  totalExpenses = 0,
  totalIncomes = 0,
}: Props) {
  const { colors } = useAppTheme();
  const navigation = useNavigation<any>();

  // Top categoria de gastos
  const topExpense = useMemo(() => {
    if (expenses.length === 0 || totalExpenses === 0) return null;
    const top = expenses[0];
    return {
      ...top,
      percentage: (top.total / totalExpenses) * 100,
    };
  }, [expenses, totalExpenses]);

  // Top categoria de receitas
  const topIncome = useMemo(() => {
    if (incomes.length === 0 || totalIncomes === 0) return null;
    const top = incomes[0];
    return {
      ...top,
      percentage: (top.total / totalIncomes) * 100,
    };
  }, [incomes, totalIncomes]);

  // Se não há dados
  const hasNoData = !topExpense && !topIncome;

  const handlePressDetails = () => {
    navigation.navigate('CategoryDetails');
  };

  if (hasNoData) {
    return (
      <View style={[styles.card, SHADOWS.card]}>
        <View style={styles.header}>
          <View style={styles.headerIconCircle}>
            <MaterialCommunityIcons name="chart-donut" size={20} color={COLORS.headerIconColor} />
          </View>
          <Text style={styles.headerTitle}>Resumo por categoria</Text>
        </View>

        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="information-outline" size={20} color={COLORS.subtleText} />
          <Text style={styles.emptyText}>
            Nenhuma movimentação registrada neste mês
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, SHADOWS.card]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIconCircle}>
          <MaterialCommunityIcons name="chart-donut" size={20} color={COLORS.headerIconColor} />
        </View>
        <Text style={styles.headerTitle}>Resumo por categoria</Text>
      </View>

      {/* Cards internos em coluna - Receita primeiro */}
      <View style={styles.cardsColumn}>
        {/* Card Maior Receita - Primeiro */}
        {topIncome && (
          <View style={[styles.innerCard, styles.incomeCard]}>
            <View style={styles.innerCardHeader}>
              <View style={[styles.labelIconCircle, { backgroundColor: COLORS.incomeAccent }]}>
                <MaterialCommunityIcons name="arrow-up" size={10} color="#FFFFFF" />
              </View>
              <Text style={[styles.labelText, { color: COLORS.incomeAccent }]}>
                MAIOR RECEITA
              </Text>
            </View>

            <View style={styles.categoryRow}>
              <View style={styles.categoryIconBox}>
                <MaterialCommunityIcons
                  name={(topIncome.categoryIcon as any) || 'cash'}
                  size={18}
                  color={COLORS.categoryText}
                />
              </View>
              <Text style={styles.categoryName} numberOfLines={1}>
                {topIncome.categoryName}
              </Text>
              <Text style={[styles.amountTextInline, { color: COLORS.incomeAccent }]}>
                {formatCurrencyBRL(topIncome.total)}
              </Text>
            </View>
          </View>
        )}

        {/* Card Maior Gasto - Segundo */}
        {topExpense && (
          <View style={[styles.innerCard, styles.expenseCard]}>
            <View style={styles.innerCardHeader}>
              <View style={[styles.labelIconCircle, { backgroundColor: COLORS.expenseAccent }]}>
                <MaterialCommunityIcons name="arrow-down" size={10} color="#FFFFFF" />
              </View>
              <Text style={[styles.labelText, { color: COLORS.expenseAccent }]}>
                MAIOR GASTO
              </Text>
            </View>

            <View style={styles.categoryRow}>
              <View style={styles.categoryIconBox}>
                <MaterialCommunityIcons
                  name={(topExpense.categoryIcon as any) || 'dots-horizontal'}
                  size={18}
                  color={COLORS.categoryText}
                />
              </View>
              <Text style={styles.categoryName} numberOfLines={1}>
                {topExpense.categoryName}
              </Text>
              <Text style={[styles.amountTextInline, { color: COLORS.expenseAccent }]}>
                {formatCurrencyBRL(topExpense.total)}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Botão CTA - Menos chamativo */}
      <Pressable
        onPress={handlePressDetails}
        style={({ pressed }) => [
          styles.ctaButton,
          { backgroundColor: colors.primaryBg, borderWidth: 1, borderColor: colors.primary },
          pressed && styles.ctaButtonPressed,
        ]}
      >
        <Text style={[styles.ctaButtonText, { color: colors.primary }]}>Ver mais detalhes</Text>
        <MaterialCommunityIcons name="arrow-right" size={16} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // ====================================================
  // CARD PRINCIPAL
  // ====================================================
  card: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 24,
    padding: 20,
    width: '100%',
    marginBottom: 16,
  },

  // ====================================================
  // HEADER
  // ====================================================
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  headerIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.headerIconBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.headerTitle,
  },

  // ====================================================
  // CARDS INTERNOS
  // ====================================================
  cardsColumn: {
    gap: 10,
    marginBottom: 16,
  },
  innerCard: {
    borderRadius: 14,
    padding: 12,
  },
  expenseCard: {
    backgroundColor: COLORS.expenseBg,
  },
  incomeCard: {
    backgroundColor: COLORS.incomeBg,
  },

  // ====================================================
  // LABEL DO CARD INTERNO
  // ====================================================
  innerCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  labelIconCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
  },

  // ====================================================
  // CATEGORIA
  // ====================================================
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.categoryText,
    flex: 1,
  },
  amountTextInline: {
    fontSize: 16,
    fontWeight: '700',
  },

  // ====================================================
  // BOTÃO CTA
  // ====================================================
  ctaButton: {
    height: 48,
    borderRadius: 14,
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  ctaButtonPressed: {
    opacity: 0.85,
  },
  ctaButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // ====================================================
  // ESTADO VAZIO
  // ====================================================
  emptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.subtleText,
    flex: 1,
  },
});

