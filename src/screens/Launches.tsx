import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, RefreshControl, Modal } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import TransactionsList, { TransactionListItem } from '../components/transactions/TransactionsList';
import AddTransactionModal, { EditableTransaction } from '../components/transactions/AddTransactionModal';
import { useTransactions } from '../hooks/useFirebaseTransactions';
import { useAppTheme } from '../contexts/themeContext';
import { useTransactionRefresh } from '../contexts/transactionRefreshContext';
import { formatCurrencyBRL } from '../utils/format';
import AppHeader from '../components/AppHeader';
import MainLayout from '../components/MainLayout';
import { spacing, borderRadius, getShadow } from '../theme';
import type { Transaction, TransactionStatus } from '../types/firebase';

// Tipos dos parâmetros de navegação
interface RouteParams {
  accountId?: string;
  accountName?: string;
}

// Nomes dos meses em português
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function Launches() {
  const { colors } = useAppTheme();
  const { refreshKey, triggerRefresh } = useTransactionRefresh();
  const route = useRoute();
  const navigation = useNavigation();
  
  // Parâmetros de navegação (filtro por conta)
  const params = (route.params as RouteParams) || {};
  const [filterAccountId, setFilterAccountId] = useState<string | undefined>(params.accountId);
  const [filterAccountName, setFilterAccountName] = useState<string | undefined>(params.accountName);
  
  // Atualizar filtro quando parâmetros mudarem
  useEffect(() => {
    const newParams = (route.params as RouteParams) || {};
    setFilterAccountId(newParams.accountId);
    setFilterAccountName(newParams.accountName);
  }, [route.params]);
  
  // Estado do mês/ano selecionado
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1); // Firebase usa 1-12
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  
  // Estado para modal de edição
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<EditableTransaction | null>(null);
  
  // Estado para painel de previsão expandido
  const [forecastExpanded, setForecastExpanded] = useState(false);
  
  // Estado para mini modal de status
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [statusTransactionId, setStatusTransactionId] = useState<string | null>(null);
  const [statusTransactionTitle, setStatusTransactionTitle] = useState<string>('');

  // Hook do Firebase - com filtro de conta se presente, senão por mês/ano
  const transactionsOptions = filterAccountId 
    ? { accountId: filterAccountId }
    : { month: selectedMonth, year: selectedYear };
    
  const { 
    transactions, 
    totalIncome, 
    totalExpense, 
    monthBalance,
    carryOverBalance,
    balance,
    loading, 
    refresh,
    deleteTransaction,
    deleteTransactionSeries,
    updateTransaction 
  } = useTransactions(transactionsOptions);
  
  // Limpar filtro de conta
  const clearAccountFilter = () => {
    setFilterAccountId(undefined);
    setFilterAccountName(undefined);
    // Limpar parâmetros da navegação
    navigation.setParams({ accountId: undefined, accountName: undefined } as any);
  };

  // Refresh when refreshKey changes (triggered after saving a new transaction)
  useEffect(() => {
    if (refreshKey > 0) {
      refresh();
    }
  }, [refreshKey]);

  // Converte transações do Firebase para o formato do TransactionsList
  const listItems = useMemo(() => {
    return transactions.map((t: Transaction) => ({
      id: t.id,
      date: t.date.toDate().toISOString().split('T')[0],
      title: t.description,
      account: t.accountName || t.creditCardName || '',
      amount: t.type === 'expense' ? -t.amount : t.amount,
      type: t.type === 'transfer' ? 'transfer' : (t.type === 'expense' ? 'paid' : 'received'),
      category: t.categoryName,
      categoryIcon: t.categoryIcon,
      status: t.status,
    }));
  }, [transactions]) as Array<{
    id: string;
    date: string;
    title: string;
    account: string;
    amount: number;
    type: 'paid' | 'received' | 'transfer';
    category?: string;
    categoryIcon?: string;
    status?: 'pending' | 'completed' | 'cancelled';
  }>;

  // Calcular totais separados por status (para previsão)
  const forecast = useMemo(() => {
    let completedIncome = 0;
    let completedExpense = 0;
    let pendingIncome = 0;
    let pendingExpense = 0;

    transactions.forEach((t: Transaction) => {
      if (t.status === 'cancelled') return;
      
      if (t.status === 'completed') {
        if (t.type === 'income') completedIncome += t.amount;
        else if (t.type === 'expense') completedExpense += t.amount;
      } else {
        // pending
        if (t.type === 'income') pendingIncome += t.amount;
        else if (t.type === 'expense') pendingExpense += t.amount;
      }
    });

    const realizedBalance = carryOverBalance + completedIncome - completedExpense;
    const forecastBalance = realizedBalance + pendingIncome - pendingExpense;

    return {
      completedIncome,
      completedExpense,
      pendingIncome,
      pendingExpense,
      realizedBalance,
      forecastBalance,
    };
  }, [transactions, carryOverBalance]);

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

  // Handler para editar transação
  const handleEditTransaction = (item: TransactionListItem) => {
    // Encontrar a transação original do Firebase
    const originalTransaction = transactions.find(t => t.id === item.id);
    if (!originalTransaction) return;

    const editData: EditableTransaction = {
      id: originalTransaction.id,
      type: originalTransaction.type,
      amount: originalTransaction.amount,
      description: originalTransaction.description,
      date: originalTransaction.date.toDate(),
      categoryId: originalTransaction.categoryId,
      categoryName: originalTransaction.categoryName,
      accountId: originalTransaction.accountId,
      accountName: originalTransaction.accountName,
      toAccountId: originalTransaction.toAccountId,
      toAccountName: originalTransaction.toAccountName,
      creditCardId: originalTransaction.creditCardId,
      creditCardName: originalTransaction.creditCardName,
      recurrence: originalTransaction.recurrence,
      seriesId: originalTransaction.seriesId,
    };

    setEditingTransaction(editData);
    setEditModalVisible(true);
  };

  // Handler para abrir modal de status
  const handleStatusPress = (item: TransactionListItem) => {
    setStatusTransactionId(item.id);
    setStatusTransactionTitle(item.title);
    setStatusModalVisible(true);
  };

  // Handler para atualizar status da transação
  const handleUpdateStatus = async (newStatus: TransactionStatus) => {
    if (!statusTransactionId) return;
    
    const result = await updateTransaction(statusTransactionId, { status: newStatus });
    if (result) {
      triggerRefresh();
    } else {
      Alert.alert('Erro', 'Não foi possível atualizar o status');
    }
    
    setStatusModalVisible(false);
    setStatusTransactionId(null);
    setStatusTransactionTitle('');
  };

  // Handler para deletar transação (chamado pelo modal)
  const handleDeleteTransaction = async (transactionId: string) => {
    const result = await deleteTransaction(transactionId);
    if (result) {
      setEditModalVisible(false);
      setEditingTransaction(null);
      triggerRefresh();
    } else {
      Alert.alert('Erro', 'Não foi possível excluir o lançamento');
    }
  };

  // Handler para deletar série de transações recorrentes
  const handleDeleteSeries = async (seriesId: string) => {
    const count = await deleteTransactionSeries(seriesId);
    if (count > 0) {
      setEditModalVisible(false);
      setEditingTransaction(null);
      triggerRefresh();
      Alert.alert('Sucesso', `${count} lançamento(s) excluído(s)`);
    } else {
      Alert.alert('Erro', 'Não foi possível excluir a série de lançamentos');
    }
  };

  // Handler para salvar edição
  const handleEditSave = () => {
    setEditModalVisible(false);
    setEditingTransaction(null);
    triggerRefresh();
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
              {/* Chip de filtro por conta */}
              {filterAccountName && (
                <View style={[styles.filterChip, { backgroundColor: colors.primaryBg }]}>
                  <MaterialCommunityIcons name="filter-variant" size={16} color={colors.primary} />
                  <Text style={[styles.filterChipText, { color: colors.primary }]}>
                    {filterAccountName}
                  </Text>
                  <Pressable
                    onPress={clearAccountFilter}
                    hitSlop={8}
                    style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                  >
                    <MaterialCommunityIcons name="close-circle" size={18} color={colors.primary} />
                  </Pressable>
                </View>
              )}

              {/* Seletor de Mês/Ano - oculto quando filtro por conta está ativo */}
              {!filterAccountId && (
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
              )}

              {/* Botão Hoje (se não estiver no mês atual) */}
              {!filterAccountId && !isCurrentMonth && (
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
                    onEditItem={handleEditTransaction}
                    onStatusPress={handleStatusPress}
                  />
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Summary Bar - Fixo acima do footer */}
        <View style={[styles.summaryContainer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          {/* Painel expandido de previsão */}
          {forecastExpanded && (
            <View style={[styles.forecastPanel, { borderBottomColor: colors.border }]}>
              <View style={styles.forecastRow}>
                <View style={styles.forecastColumn}>
                  <Text style={[styles.forecastLabel, { color: colors.textMuted }]}>Recebido</Text>
                  <Text style={[styles.forecastValue, { color: incomeColor }]}>
                    {formatCurrencyBRL(forecast.completedIncome)}
                  </Text>
                </View>
                <View style={styles.forecastColumn}>
                  <Text style={[styles.forecastLabel, { color: colors.textMuted }]}>A receber</Text>
                  <Text style={[styles.forecastValue, { color: colors.textSecondary }]}>
                    {formatCurrencyBRL(forecast.pendingIncome)}
                  </Text>
                </View>
              </View>
              <View style={styles.forecastRow}>
                <View style={styles.forecastColumn}>
                  <Text style={[styles.forecastLabel, { color: colors.textMuted }]}>Pago</Text>
                  <Text style={[styles.forecastValue, { color: expenseColor }]}>
                    {formatCurrencyBRL(forecast.completedExpense)}
                  </Text>
                </View>
                <View style={styles.forecastColumn}>
                  <Text style={[styles.forecastLabel, { color: colors.textMuted }]}>A pagar</Text>
                  <Text style={[styles.forecastValue, { color: colors.textSecondary }]}>
                    {formatCurrencyBRL(forecast.pendingExpense)}
                  </Text>
                </View>
              </View>
              <View style={[styles.forecastDivider, { backgroundColor: colors.border }]} />
              <View style={styles.forecastRow}>
                <View style={styles.forecastColumn}>
                  <Text style={[styles.forecastLabel, { color: colors.textMuted }]}>Saldo realizado</Text>
                  <Text style={[styles.forecastValue, { color: forecast.realizedBalance >= 0 ? balanceColor : expenseColor }]}>
                    {formatCurrencyBRL(forecast.realizedBalance)}
                  </Text>
                </View>
                <View style={styles.forecastColumn}>
                  <Text style={[styles.forecastLabel, { color: colors.textMuted }]}>Previsão final</Text>
                  <Text style={[styles.forecastValue, { color: forecast.forecastBalance >= 0 ? balanceColor : expenseColor, fontWeight: '700' }]}>
                    {formatCurrencyBRL(forecast.forecastBalance)}
                  </Text>
                </View>
              </View>
            </View>
          )}
          
          {/* Botão de expandir/recolher */}
          <Pressable
            onPress={() => setForecastExpanded(!forecastExpanded)}
            style={({ pressed }) => [styles.expandButton, pressed && { opacity: 0.7 }]}
          >
            <MaterialCommunityIcons 
              name={forecastExpanded ? 'chevron-down' : 'chevron-up'} 
              size={20} 
              color={colors.primary} 
            />
          </Pressable>

          {/* Resumo compacto */}
          <View style={styles.summaryBar}>
            {/* Saldo anterior (se existir) */}
            {carryOverBalance !== 0 && (
              <>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: carryOverBalance >= 0 ? colors.textSecondary : expenseColor, fontSize: 13 }]}>
                    {formatCurrencyBRL(carryOverBalance)}
                  </Text>
                  <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>anterior</Text>
                </View>
                <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
              </>
            )}
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
      </View>

      {/* Mini Modal de Status */}
      <Modal
        visible={statusModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setStatusModalVisible(false)}
      >
        <Pressable 
          style={styles.statusModalOverlay} 
          onPress={() => setStatusModalVisible(false)}
        >
          <View style={[styles.statusModalContent, { backgroundColor: colors.card }, getShadow(colors)]}>
            <Text style={[styles.statusModalTitle, { color: colors.text }]}>
              Lançamento concluído?
            </Text>
            <Text style={[styles.statusModalSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
              {statusTransactionTitle}
            </Text>
            
            <View style={styles.statusModalButtons}>
              <Pressable
                onPress={() => handleUpdateStatus('pending')}
                style={({ pressed }) => [
                  styles.statusModalButton,
                  { backgroundColor: colors.grayLight },
                  pressed && { opacity: 0.7 }
                ]}
              >
                <MaterialCommunityIcons name="circle-outline" size={20} color={colors.textMuted} />
                <Text style={[styles.statusModalButtonText, { color: colors.text }]}>Pendente</Text>
              </Pressable>
              
              <Pressable
                onPress={() => handleUpdateStatus('completed')}
                style={({ pressed }) => [
                  styles.statusModalButton,
                  { backgroundColor: '#10b98120' },
                  pressed && { opacity: 0.7 }
                ]}
              >
                <MaterialCommunityIcons name="check-circle" size={20} color="#10b981" />
                <Text style={[styles.statusModalButtonText, { color: '#10b981' }]}>Concluído</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Modal de edição */}
      <AddTransactionModal
        visible={editModalVisible}
        onClose={() => {
          setEditModalVisible(false);
          setEditingTransaction(null);
        }}
        onSave={handleEditSave}
        onDelete={handleDeleteTransaction}
        onDeleteSeries={handleDeleteSeries}
        editTransaction={editingTransaction}
      />
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
  summaryContainer: {
    borderTopWidth: 1,
  },
  expandButton: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  forecastPanel: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  forecastRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  forecastColumn: {
    flex: 1,
  },
  forecastLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  forecastValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  forecastDivider: {
    height: 1,
    marginVertical: spacing.sm,
  },
  summaryBar: {
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
  statusModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusModalContent: {
    width: '80%',
    maxWidth: 320,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  statusModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  statusModalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  statusModalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statusModalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  statusModalButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
