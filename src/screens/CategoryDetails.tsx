import { View, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Modal, RefreshControl, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/authContext';
import { useAppTheme } from '../contexts/themeContext';
import { useTransactionRefresh } from '../contexts/transactionRefreshContext';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { spacing, borderRadius, getShadow } from '../theme';
import { formatCurrencyBRL } from '../utils/format';
import * as transactionService from '../services/transactionService';
import MainLayout from '../components/MainLayout';
import AppHeader from '../components/AppHeader';
import { useNavigation } from '@react-navigation/native';

type ViewMode = 'monthly' | 'yearly';
type TransactionTypeFilter = 'expense' | 'income';

interface CategoryData {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  total: number;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function CategoryDetails() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const { refreshKey } = useTransactionRefresh();
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [transactionType, setTransactionType] = useState<TransactionTypeFilter>('expense');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Período selecionado
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  
  // Dados
  const [expenseData, setExpenseData] = useState<any>(null);
  const [incomeData, setIncomeData] = useState<any>(null);
  const [showYearPicker, setShowYearPicker] = useState(false);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async (isRefreshing = false) => {
    if (!user) return;

    if (!isRefreshing) {
      setLoading(true);
    }
    
    try {
      const currentYear = new Date().getFullYear();
      
      // Carregar dados de despesas e receitas em paralelo
      const [expenses, incomes] = await Promise.all([
        transactionService.getCategoryDataOverTime(user.uid, currentYear - 3, currentYear, 'expense'),
        transactionService.getCategoryDataOverTime(user.uid, currentYear - 3, currentYear, 'income'),
      ]);

      setExpenseData(expenses);
      setIncomeData(incomes);
    } catch (error) {
      console.error('Erro ao carregar dados de categorias:', error);
    } finally {
      if (isRefreshing) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  // Refresh quando refreshKey mudar (após salvar transação)
  useEffect(() => {
    if (refreshKey > 0) {
      loadData(true);
    }
  }, [refreshKey]);

  // Refresh quando a tela ganhar foco
  useFocusEffect(
    useCallback(() => {
      loadData(true);
    }, [user])
  );

  // Pull to refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(true);
  }, [user]);

  // Navegação de mês
  const goToPreviousMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedYear === today.getFullYear() && selectedMonth === today.getMonth() + 1) {
      return;
    }

    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const goToToday = () => {
    setSelectedMonth(today.getMonth() + 1);
    setSelectedYear(today.getFullYear());
  };

  const isCurrentMonth = selectedMonth === today.getMonth() + 1 && selectedYear === today.getFullYear();

  // Selecionar dados baseado no tipo de transação
  const allData = transactionType === 'expense' ? expenseData : incomeData;

  // Dados do período atual
  const currentPeriodData = useMemo(() => {
    if (!allData) return null;

    if (viewMode === 'monthly') {
      const monthData = allData.monthlyData.find(
        (m: any) => m.month === selectedMonth && m.year === selectedYear
      );
      if (!monthData) return null;

      const categories = Array.from(monthData.categories.values()).sort(
        (a: any, b: any) => b.total - a.total
      );
      const total = categories.reduce((sum: number, cat: any) => sum + cat.total, 0);

      return { categories, total };
    } else {
      const yearData = allData.yearlyData.find((y: any) => y.year === selectedYear);
      if (!yearData) return null;

      const categories = Array.from(yearData.categories.values()).sort(
        (a: any, b: any) => b.total - a.total
      );
      const total = categories.reduce((sum: number, cat: any) => sum + cat.total, 0);

      return { categories, total };
    }
  }, [allData, viewMode, selectedMonth, selectedYear, transactionType]);

  // Gerar insights
  const insights = useMemo(() => {
    if (!allData || !currentPeriodData) return [];

    const messages: string[] = [];
    const isExpense = transactionType === 'expense';
    const verbGasto = isExpense ? 'gastava' : 'recebia';
    const nomeGasto = isExpense ? 'gastos' : 'receitas';
    const nomeGastoSingular = isExpense ? 'gasto' : 'receita';

    if (viewMode === 'monthly') {
      // Comparar com mês anterior
      let prevMonth = selectedMonth - 1;
      let prevYear = selectedYear;
      if (prevMonth === 0) {
        prevMonth = 12;
        prevYear = selectedYear - 1;
      }

      const prevMonthData = allData.monthlyData.find(
        (m: any) => m.month === prevMonth && m.year === prevYear
      );

      if (prevMonthData && currentPeriodData.categories.length > 0) {
        const currentTop = currentPeriodData.categories[0];
        const prevCategories = Array.from(prevMonthData.categories.values());
        const prevTop = prevCategories.sort((a: any, b: any) => b.total - a.total)[0];

        if (prevTop && currentTop.categoryId !== prevTop.categoryId) {
          messages.push(`No passado, você ${verbGasto} mais com ${prevTop.categoryName}.`);
        }

        // Verificar categoria com maior redução
        const prevCategoryMap = new Map(
          prevCategories.map((c: any) => [c.categoryId, c.total])
        );

        let maxReduction = 0;
        let reducedCategory = null;

        for (const cat of currentPeriodData.categories) {
          const prevTotal = prevCategoryMap.get(cat.categoryId) || 0;
          if (prevTotal > 0) {
            const reduction = ((prevTotal - cat.total) / prevTotal) * 100;
            if (reduction > maxReduction && reduction > 10) {
              maxReduction = reduction;
              reducedCategory = cat;
            }
          }
        }

        if (reducedCategory) {
          messages.push(`Neste mês, suas ${nomeGasto} com ${reducedCategory.categoryName} diminuíram.`);
        }
      }
    } else {
      // Insights anuais
      if (currentPeriodData.categories.length > 0) {
        const topCategory = currentPeriodData.categories[0];
        const percentage = ((topCategory.total / currentPeriodData.total) * 100).toFixed(0);
        messages.push(
          `${topCategory.categoryName} foi sua categoria com maior ${nomeGastoSingular} no ano (${percentage}%).`
        );
      }

      // Comparar com ano anterior
      const prevYearData = allData.yearlyData.find((y: any) => y.year === selectedYear - 1);
      if (prevYearData && currentPeriodData.categories.length > 1) {
        const secondCategory = currentPeriodData.categories[1];
        const prevCategories = Array.from(prevYearData.categories.values());
        const prevSecond = prevCategories.find((c: any) => c.categoryId === secondCategory.categoryId);

        if (prevSecond && prevSecond.total > secondCategory.total) {
          messages.push(
            `${secondCategory.categoryName} representou uma parcela menor em comparação ao ano anterior.`
          );
        }
      }
    }

    return messages.slice(0, 3);
  }, [allData, currentPeriodData, viewMode, selectedMonth, selectedYear]);

  // Anos disponíveis para seleção
  const availableYears = useMemo(() => {
    if (!allData) return [];
    const years = allData.yearlyData.map((y: any) => y.year).sort((a: number, b: number) => b - a);
    return years;
  }, [allData]);

  // Cores baseadas no tipo de transação
  const valueColor = transactionType === 'expense' ? colors.expense : colors.income;
  const iconBgColor = transactionType === 'expense' ? colors.dangerBg : (colors.successBg || '#DCFCE7');

  const renderCategoryCard = (category: any, index: number) => {
    if (!currentPeriodData) return null;

    const percentage = currentPeriodData.total > 0 
      ? (category.total / currentPeriodData.total) * 100 
      : 0;

    return (
      <View key={category.categoryId} style={[styles.categoryCard, { backgroundColor: colors.card }, getShadow(colors)]}>
        <View style={styles.categoryHeader}>
          <View style={[styles.categoryIcon, { backgroundColor: iconBgColor }]}>
            <MaterialCommunityIcons name={category.categoryIcon as any} size={24} color={valueColor} />
          </View>
          <View style={styles.categoryInfo}>
            <Text style={[styles.categoryName, { color: colors.text }]}>{category.categoryName}</Text>
            <Text style={[styles.categoryPercentage, { color: colors.textMuted }]}>
              {percentage.toFixed(0)}% do total
            </Text>
          </View>
          <Text style={[styles.categoryValue, { color: valueColor }]}>
            {formatCurrencyBRL(category.total)}
          </Text>
        </View>
        
        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
          <View 
            style={[
              styles.progressFill, 
              { 
                width: `${Math.min(percentage, 100)}%`,
                backgroundColor: valueColor
              }
            ]} 
          />
        </View>
      </View>
    );
  };

  const renderYearPickerModal = () => (
    <Modal
      visible={showYearPicker}
      transparent
      animationType="fade"
      onRequestClose={() => setShowYearPicker(false)}
    >
      <TouchableOpacity 
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowYearPicker(false)}
      >
        <View style={[styles.yearPickerContainer, { backgroundColor: colors.card }, getShadow(colors)]}>
          <Text style={[styles.yearPickerTitle, { color: colors.text }]}>Selecionar ano</Text>
          
          {availableYears.map((year) => (
            <TouchableOpacity
              key={year}
              style={styles.yearOption}
              onPress={() => {
                setSelectedYear(year);
                setShowYearPicker(false);
              }}
            >
              <View style={[
                styles.radioButton,
                { borderColor: year === selectedYear ? colors.primary : colors.border }
              ]}>
                {year === selectedYear && (
                  <View style={[styles.radioButtonInner, { backgroundColor: colors.primary }]} />
                )}
              </View>
              <Text style={[styles.yearOptionText, { color: colors.text }]}>
                {year} {year === today.getFullYear() && '(atual)'}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => setShowYearPicker(false)}
          >
            <Text style={[styles.cancelButtonText, { color: colors.textMuted }]}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <MainLayout>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader />
        
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {/* Header Card */}
          <View style={[styles.headerCard, { backgroundColor: colors.card }, getShadow(colors)]}>
            {viewMode === 'monthly' ? (
              <>
                {/* Navegação de mês */}
                <View style={styles.monthNav}>
                  <Pressable 
                    onPress={goToPreviousMonth}
                    style={({ pressed }) => [styles.navButton, pressed && { opacity: 0.7 }]}
                  >
                    <MaterialCommunityIcons name="chevron-left" size={28} color={colors.primary} />
                  </Pressable>
                  
                  <Pressable 
                    onPress={goToToday}
                    style={({ pressed }) => [styles.monthDisplay, pressed && { opacity: 0.8 }]}
                  >
                    <Text style={[styles.monthText, { color: colors.text }]}>
                      {MONTH_NAMES[selectedMonth - 1]}
                    </Text>
                    <Text style={[styles.yearText, { color: colors.textMuted }]}>
                      {selectedYear}
                    </Text>
                  </Pressable>
                  
                  <Pressable 
                    onPress={goToNextMonth}
                    style={({ pressed }) => [styles.navButton, pressed && { opacity: 0.7 }]}
                  >
                    <MaterialCommunityIcons name="chevron-right" size={28} color={colors.primary} />
                  </Pressable>
                </View>

                {/* Botão Ir para hoje */}
                {!isCurrentMonth && (
                  <View style={styles.todayButtonContainer}>
                    <Pressable 
                      onPress={goToToday}
                      style={({ pressed }) => [
                        styles.todayButton, 
                        { backgroundColor: colors.primaryBg },
                        pressed && { opacity: 0.8 }
                      ]}
                    >
                      <MaterialCommunityIcons name="calendar-today" size={16} color={colors.primary} />
                      <Text style={[styles.todayButtonText, { color: colors.primary }]}>Ir para hoje</Text>
                    </Pressable>
                  </View>
                )}
              </>
            ) : (
              <TouchableOpacity 
                style={styles.yearSelector}
                onPress={() => setShowYearPicker(true)}
              >
                <Text style={[styles.yearSelectorText, { color: colors.text }]}>
                  Ano: {selectedYear}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={20} color={colors.text} />
              </TouchableOpacity>
            )}

            {/* Toggle View Mode */}
            <View style={[styles.viewModeToggle, { backgroundColor: colors.grayLight }]}>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  viewMode === 'monthly' && { backgroundColor: colors.card }
                ]}
                onPress={() => setViewMode('monthly')}
              >
                <Text style={[
                  styles.toggleText,
                  { color: viewMode === 'monthly' ? colors.primary : colors.textMuted }
                ]}>
                  Mês
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  viewMode === 'yearly' && { backgroundColor: colors.card }
                ]}
                onPress={() => setViewMode('yearly')}
              >
                <Text style={[
                  styles.toggleText,
                  { color: viewMode === 'yearly' ? colors.primary : colors.textMuted }
                ]}>
                  Ano
                </Text>
              </TouchableOpacity>
            </View>

            {/* Toggle Transaction Type (Despesas / Receitas) */}
            <View style={[styles.viewModeToggle, { backgroundColor: colors.grayLight, marginTop: spacing.sm }]}>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  transactionType === 'expense' && { backgroundColor: colors.card }
                ]}
                onPress={() => setTransactionType('expense')}
              >
                <MaterialCommunityIcons 
                  name="arrow-down" 
                  size={14} 
                  color={transactionType === 'expense' ? colors.expense : colors.textMuted} 
                />
                <Text style={[
                  styles.toggleText,
                  { color: transactionType === 'expense' ? colors.expense : colors.textMuted, marginLeft: 4 }
                ]}>
                  Despesas
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  transactionType === 'income' && { backgroundColor: colors.card }
                ]}
                onPress={() => setTransactionType('income')}
              >
                <MaterialCommunityIcons 
                  name="arrow-up" 
                  size={14} 
                  color={transactionType === 'income' ? colors.income : colors.textMuted} 
                />
                <Text style={[
                  styles.toggleText,
                  { color: transactionType === 'income' ? colors.income : colors.textMuted, marginLeft: 4 }
                ]}>
                  Receitas
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : !currentPeriodData || currentPeriodData.categories.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.grayLight }]}>
              <MaterialCommunityIcons name="information" size={24} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {transactionType === 'expense' 
                  ? 'Nenhum gasto registrado neste período'
                  : 'Nenhuma receita registrada neste período'}
              </Text>
            </View>
          ) : (
            <>
              {/* Categorias */}
              {currentPeriodData.categories.map((category: any, index: number) => 
                renderCategoryCard(category, index)
              )}

              {/* Insights */}
              {insights.length > 0 && (
                <View style={[styles.insightsCard, { backgroundColor: colors.card }, getShadow(colors)]}>
                  <View style={styles.insightsHeader}>
                    <MaterialCommunityIcons name="lightbulb-on" size={20} color={colors.warning || '#F59E0B'} />
                    <Text style={[styles.insightsTitle, { color: colors.text }]}>Insights</Text>
                  </View>

                  {insights.map((insight, index) => (
                    <View key={index} style={styles.insightItem}>
                      <MaterialCommunityIcons 
                        name={
                          insight.includes('diminuíram') ? 'trending-down' :
                          insight.includes('maior gasto') ? 'brain' :
                          'chart-line'
                        }
                        size={18} 
                        color={colors.primary} 
                      />
                      <Text style={[styles.insightText, { color: colors.text }]}>{insight}</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>

        {renderYearPickerModal()}
      </View>
    </MainLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  headerCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  navButton: {
    padding: spacing.xs,
  },
  monthDisplay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  monthText: {
    fontSize: 18,
    fontWeight: '700',
  },
  yearText: {
    fontSize: 14,
    marginTop: 2,
  },
  todayButtonContainer: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  todayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  todayButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  yearSelectorText: {
    fontSize: 16,
    fontWeight: '600',
  },
  viewModeToggle: {
    flexDirection: 'row',
    borderRadius: borderRadius.md,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    padding: spacing.xl * 2,
    alignItems: 'center',
  },
  emptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: 14,
  },
  categoryCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  categoryPercentage: {
    fontSize: 13,
  },
  categoryValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  insightsCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  insightsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  insightsTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  insightText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  yearPickerContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
  },
  yearPickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  yearOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  yearOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  cancelButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
