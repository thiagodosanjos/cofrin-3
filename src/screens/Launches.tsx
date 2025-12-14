import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import TransactionsList from '../components/transactions/TransactionsList';
import { useTransactions } from '../hooks/useFirebaseTransactions';
import { useAppTheme } from '../contexts/themeContext';
import { formatCurrencyBRL } from '../utils/format';
import AppHeader from '../components/AppHeader';
import MainLayout from '../components/MainLayout';
import { spacing, borderRadius, getShadow } from '../theme';
import type { Transaction } from '../types/firebase';

// Nomes dos meses em português
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function Launches() {
  const { colors } = useAppTheme();
  
  // Estado do mês/ano selecionado
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1); // Firebase usa 1-12
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());

  // Hook do Firebase com mês/ano selecionado
  const { 
    transactions, 
    totalIncome, 
    totalExpense, 
    balance,
    loading, 
    refresh,
    deleteTransaction 
  } = useTransactions({ 
    month: selectedMonth, 
    year: selectedYear 
  });

  // Converte transações do Firebase para o formato do TransactionsList
  const listItems = useMemo(() => {
    return transactions.map((t: Transaction) => ({
      id: t.id,
      date: t.date.toDate().toISOString().split('T')[0],
      title: t.description,
      account: t.accountName || t.creditCardName || '',
      amount: t.type === 'expense' ? -t.amount : t.amount,
      type: t.type === 'expense' ? 'paid' : 'received',
      category: t.categoryName,
      categoryIcon: t.categoryIcon,
    }));
  }, [transactions]);

  // Navegação entre meses
  const goToPreviousMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const goToNextMonth = () => {
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

  // Handler para deletar transação
  const handleDeleteTransaction = async (transactionId: string) => {
    Alert.alert(
      'Excluir lançamento',
      'Tem certeza que deseja excluir este lançamento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Excluir', 
          style: 'destructive',
          onPress: async () => {
            const result = await deleteTransaction(transactionId);
            if (!result) {
              Alert.alert('Erro', 'Não foi possível excluir o lançamento');
            }
          }
        },
      ]
    );
  };

  // Verifica se é o mês atual
  const isCurrentMonth = selectedMonth === (today.getMonth() + 1) && selectedYear === today.getFullYear();
  
  // Verifica se é mês futuro
  const isFutureMonth = selectedYear > today.getFullYear() || 
    (selectedYear === today.getFullYear() && selectedMonth > (today.getMonth() + 1));

  // Cores específicas para o resumo
  const incomeColor = '#10b981';
  const expenseColor = '#dc2626';
  const balanceColor = colors.primary;

  return (
    <MainLayout>
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent} 
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={refresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          <AppHeader />
          <View style={styles.content}>
            <View style={styles.maxWidth}>
              {/* Seletor de Mês/Ano */}
              <View style={[styles.monthSelector, { backgroundColor: colors.card }, getShadow(colors)]}>
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
                    {MONTHS[selectedMonth - 1]}
                  </Text>
                  <Text style={[styles.yearText, { color: colors.textSecondary }]}>
                    {selectedYear}
                  </Text>
                  {isFutureMonth && (
                    <View style={[styles.futureBadge, { backgroundColor: colors.primaryBg }]}>
                      <Text style={[styles.futureBadgeText, { color: colors.primary }]}>Futuro</Text>
                    </View>
                  )}
                </Pressable>
                
                <Pressable 
                  onPress={goToNextMonth}
                  style={({ pressed }) => [styles.navButton, pressed && { opacity: 0.7 }]}
                >
                  <MaterialCommunityIcons name="chevron-right" size={28} color={colors.primary} />
                </Pressable>
              </View>

              {/* Botão Hoje (se não estiver no mês atual) */}
              {!isCurrentMonth && (
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
              )}

              {/* Lista de Transações */}
              {loading ? (
                <View style={[styles.emptyCard, { backgroundColor: colors.card }, getShadow(colors)]}>
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>Carregando...</Text>
                </View>
              ) : listItems.length === 0 ? (
                <View style={[styles.emptyCard, { backgroundColor: colors.card }, getShadow(colors)]}>
                  <View style={[styles.emptyIcon, { backgroundColor: colors.primaryBg }]}>
                    <MaterialCommunityIcons 
                      name={isFutureMonth ? "calendar-clock" : "calendar-blank"} 
                      size={40} 
                      color={colors.primary} 
                    />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>
                    {isFutureMonth ? 'Nenhum lançamento futuro' : 'Nenhum lançamento'}
                  </Text>
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                    {isFutureMonth 
                      ? 'Você ainda não tem despesas programadas para este mês.'
                      : 'Não há lançamentos registrados neste período.'}
                  </Text>
                </View>
              ) : (
                <View style={[styles.listCard, { backgroundColor: colors.card }, getShadow(colors)]}>
                  <View style={styles.listHeader}>
                    <Text style={[styles.listTitle, { color: colors.text }]}>
                      {listItems.length} lançamento{listItems.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <TransactionsList 
                    items={listItems} 
                    onDeleteItem={handleDeleteTransaction}
                  />
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Summary Bar - Fixo acima do footer */}
        <View style={[styles.summaryBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: incomeColor }]}>{formatCurrencyBRL(totalIncome)}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>entradas</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: expenseColor }]}>{formatCurrencyBRL(totalExpense)}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>saídas</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: balance >= 0 ? balanceColor : expenseColor }]}>
              {formatCurrencyBRL(balance)}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>saldo</Text>
          </View>
        </View>
      </View>
    </MainLayout>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.md,
  },
  content: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  maxWidth: {
    width: '100%',
    maxWidth: 980,
    paddingHorizontal: spacing.md,
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  navButton: {
    padding: spacing.sm,
  },
  monthDisplay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  monthText: {
    fontSize: 20,
    fontWeight: '700',
  },
  yearText: {
    fontSize: 14,
    marginTop: 2,
  },
  futureBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    marginTop: spacing.xs,
  },
  futureBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  todayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    alignSelf: 'center',
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  todayButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyCard: {
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontWeight: '700',
    marginBottom: spacing.sm,
    fontSize: 16,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  listCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  listHeader: {
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryBar: {
    borderTopWidth: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 32,
  },
  summaryValue: {
    fontWeight: '700',
    fontSize: 15,
  },
  summaryLabel: {
    fontSize: 11,
    marginTop: 2,
  },
});
