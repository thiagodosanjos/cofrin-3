import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCustomAlert } from "../hooks/useCustomAlert";
import { useSnackbar } from "../hooks/useSnackbar";
import CustomAlert from "../components/CustomAlert";
import Snackbar from "../components/Snackbar";
import LoadingOverlay from "../components/LoadingOverlay";
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTransactions } from '../hooks/useFirebaseTransactions';
import { useAppTheme } from '../contexts/themeContext';
import { useAuth } from '../contexts/authContext';
import { useTransactionRefresh } from '../contexts/transactionRefreshContext';
import { useAccounts } from '../hooks/useAccounts';
import AddTransactionModal, { EditableTransaction } from '../components/transactions/AddTransactionModal';
import TransactionItem from '../components/transactions/TransactionItem';
import SimpleHeader from '../components/SimpleHeader';
import MainLayout from '../components/MainLayout';
import { spacing, borderRadius, getShadow } from '../theme';
import { formatCurrencyBRL } from '../utils/format';
import {
    getBillDetails,
    payBill,
    unpayBill,
    getMonthName,
    CreditCardBillWithTransactions
} from '../services/creditCardBillService';
import type { Transaction } from '../types/firebase';

interface RouteParams {
  creditCardId: string;
  creditCardName: string;
  month: number;
  year: number;
}

export default function CreditCardBillDetails() {
  const { alertState, showAlert, hideAlert } = useCustomAlert();
  const { snackbarState, showSnackbar, hideSnackbar } = useSnackbar();
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const { triggerRefresh, refreshKey } = useTransactionRefresh();
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params as RouteParams;
  
  const { activeAccounts } = useAccounts();
  const { deleteTransaction, deleteTransactionSeries } = useTransactions();
  
  // Estado para mês e ano navegáveis
  const [selectedMonth, setSelectedMonth] = useState(params.month);
  const [selectedYear, setSelectedYear] = useState(params.year);
  
  const [bill, setBill] = useState<CreditCardBillWithTransactions | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [unpaying, setUnpaying] = useState(false);
  
  // Estado para loading overlay (operações longas)
  const [loadingOverlay, setLoadingOverlay] = useState({
    visible: false,
    message: '',
  });
  
  // Modal de seleção de conta para pagamento
  const [payModalVisible, setPayModalVisible] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedAccountName, setSelectedAccountName] = useState('');
  
  // Modal de edição de transação
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<EditableTransaction | null>(null);

  // Carregar detalhes da fatura
  const loadBillDetails = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const billData = await getBillDetails(
        user.uid,
        params.creditCardId,
        selectedMonth,
        selectedYear
      );
      setBill(billData);
    } catch (error) {
      console.error('Erro ao carregar fatura:', error);
      showAlert('Erro', 'Não foi possível carregar os detalhes da fatura', [{ text: 'OK' }]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadBillDetails();
  }, [user, selectedMonth, selectedYear, refreshKey]);

  const onRefresh = () => {
    setRefreshing(true);
    loadBillDetails();
  };

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
    const today = new Date();
    setSelectedMonth(today.getMonth() + 1);
    setSelectedYear(today.getFullYear());
  };

  // Verificar se é o mês atual
  const today = new Date();
  const isCurrentMonth = selectedMonth === today.getMonth() + 1 && selectedYear === today.getFullYear();
  const isFutureMonth = selectedYear > today.getFullYear() || 
    (selectedYear === today.getFullYear() && selectedMonth > today.getMonth() + 1);

  // Agrupar transações por data
  const groupedTransactions = useMemo(() => {
    if (!bill?.transactions) return {};
    
    const groups: Record<string, Transaction[]> = {};
    bill.transactions.forEach((t) => {
      const date = t.date.toDate().toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: 'long' 
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(t);
    });
    
    return groups;
  }, [bill?.transactions]);

  // Calcular resumo
  const summary = useMemo(() => {
    if (!bill?.transactions) return { expenses: 0, refunds: 0, total: 0 };
    
    let expenses = 0;
    let refunds = 0;
    
    bill.transactions.forEach((t) => {
      if (t.status === 'cancelled') return;
      if (t.type === 'expense') expenses += t.amount;
      else refunds += t.amount;
    });
    
    return {
      expenses,
      refunds,
      total: expenses - refunds,
    };
  }, [bill?.transactions]);

  // Abrir modal de pagamento
  const handlePayBill = () => {
    if (!bill?.creditCard?.paymentAccountId) {
      showAlert(
        'Conta não configurada',
        'Este cartão não tem uma conta de pagamento configurada. Edite o cartão para definir uma conta.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    // Pré-selecionar a conta de pagamento do cartão
    const paymentAccount = activeAccounts.find(a => a.id === bill.creditCard?.paymentAccountId);
    if (paymentAccount) {
      setSelectedAccountId(paymentAccount.id);
      setSelectedAccountName(paymentAccount.name);
    }
    
    setPayModalVisible(true);
  };

  // Confirmar pagamento
  const confirmPayment = async () => {
    if (!bill || !selectedAccountId) return;
    
    const accountName = selectedAccountName || 'conta selecionada';
    
    showAlert(
      'Confirmar Pagamento',
      `Você está pagando a fatura de ${formatCurrencyBRL(summary.total)} na conta ${accountName}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Pagar',
          onPress: async () => {
            // Fechar modal de seleção de conta
            setPayModalVisible(false);
            
            // Mostrar loading overlay
            setLoadingOverlay({ visible: true, message: 'Pagando fatura...' });
            
            try {
              await payBill(
                bill.id,
                bill.creditCardId,
                selectedAccountId,
                summary.total
              );
              
              // Atualizar dados antes de esconder loading
              setLoadingOverlay({ visible: true, message: 'Atualizando...' });
              await loadBillDetails();
              triggerRefresh();
              
              // Aguardar um pouco para garantir que o refresh foi processado
              await new Promise(resolve => setTimeout(resolve, 200));
              
              // Esconder loading e mostrar sucesso
              setLoadingOverlay({ visible: false, message: '' });
              showSnackbar('Fatura paga com sucesso!');
            } catch (error) {
              console.error('Erro ao pagar fatura:', error);
              setLoadingOverlay({ visible: false, message: '' });
              showAlert('Erro', 'Não foi possível pagar a fatura', [{ text: 'OK' }]);
            }
          },
        },
      ]
    );
  };

  // Editar transação
  const handleEditTransaction = (transaction: Transaction) => {
    // Bloquear edição se a fatura estiver paga
    if (bill?.isPaid) {
      showAlert(
        'Ação não permitida',
        'Não é possível editar transações de uma fatura já paga. Desfaça o pagamento primeiro.',
        [{ text: 'OK' }]
      );
      return;
    }

    const editData: EditableTransaction = {
      id: transaction.id,
      type: transaction.type,
      amount: transaction.amount,
      description: transaction.description,
      date: transaction.date.toDate(),
      categoryId: transaction.categoryId,
      categoryName: transaction.categoryName,
      // Se tem creditCardId, NÃO passar accountId (evita confusão no modal)
      accountId: transaction.creditCardId ? undefined : transaction.accountId,
      accountName: transaction.creditCardId ? undefined : transaction.accountName,
      toAccountId: transaction.toAccountId,
      toAccountName: transaction.toAccountName,
      creditCardId: transaction.creditCardId,
      creditCardName: transaction.creditCardName,
      recurrence: transaction.recurrence,
      seriesId: transaction.seriesId,
    };

    setEditingTransaction(editData);
    setEditModalVisible(true);
  };


  // Título da fatura
  const billTitle = `Fatura ${getMonthName(selectedMonth)} ${selectedYear}`;

  // Nomes dos meses abreviados
  const MONTHS = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
  ];
  const monthYearLabel = `${MONTHS[selectedMonth - 1]} ${selectedYear}`;

  return (
    <MainLayout>
      <SimpleHeader title={`Fatura ${params.creditCardName}`} />
      
      <ScrollView
        style={[styles.container, { backgroundColor: colors.bg }]}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.centeredContainer}>
        <View style={styles.content}>
        {/* Navegação de Mês */}
        <View style={[styles.monthNavigation, { backgroundColor: colors.card }, getShadow(colors)]}>
          <Pressable 
            onPress={goToPreviousMonth}
            style={({ pressed }) => [styles.navButton, pressed && { opacity: 0.7 }]}
          >
            <MaterialCommunityIcons name="chevron-left" size={28} color={colors.primary} />
          </Pressable>
          
          <Pressable 
            onPress={goToToday}
            style={({ pressed }) => [styles.monthLabelContainer, pressed && { opacity: 0.8 }]}
          >
            <Text style={[styles.monthLabel, { color: colors.text }]}>
              {monthYearLabel}
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

        {/* Botão Ir para Hoje */}
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

        {/* Card do resumo da fatura */}
        <View style={[styles.billCard, { backgroundColor: colors.card, ...getShadow(colors) }]}>
          {/* Header com ícone e informações principais */}
          <View style={styles.billHeader}>
            <View style={[styles.cardIconContainer, { backgroundColor: `${colors.primary}15` }]}>
              <MaterialCommunityIcons name="credit-card" size={28} color={colors.primary} />
            </View>
            <View style={styles.billTitleContainer}>
              <Text style={[styles.billTitle, { color: colors.text }]}>{billTitle}</Text>
              {bill?.isPaid ? (
                <View style={[styles.statusBadge, { backgroundColor: colors.successBg }]}>
                  <MaterialCommunityIcons name="check-circle" size={14} color={colors.success} />
                  <Text style={[styles.statusText, { color: colors.success }]}>Paga</Text>
                </View>
              ) : summary.total > 0 ? (
                <View style={[styles.statusBadge, { backgroundColor: colors.warningBg }]}>
                  <MaterialCommunityIcons name="clock-outline" size={14} color={colors.warning} />
                  <Text style={[styles.statusText, { color: colors.warning }]}>Pagamento Pendente</Text>
                </View>
              ) : (
                <View style={[styles.statusBadge, { backgroundColor: colors.successBg }]}>
                  <MaterialCommunityIcons name="check-circle-outline" size={14} color={colors.success} />
                  <Text style={[styles.statusText, { color: colors.success }]}>Sem lançamentos</Text>
                </View>
              )}
            </View>
          </View>

          {/* Datas de fechamento e vencimento */}
          <View style={[styles.datesRow, { borderBottomColor: colors.border }]}>
            <View style={styles.dateItem}>
              <MaterialCommunityIcons name="calendar-lock" size={18} color={colors.textMuted} />
              <View style={styles.dateInfo}>
                <Text style={[styles.dateLabel, { color: colors.textMuted }]}>Fechamento</Text>
                <Text style={[styles.dateValue, { color: colors.text }]}>
                  Dia {bill?.creditCard?.closingDay || '-'}
                </Text>
              </View>
            </View>
            <View style={[styles.dateSeparator, { backgroundColor: colors.border }]} />
            <View style={styles.dateItem}>
              <MaterialCommunityIcons name="calendar-clock" size={18} color={colors.textMuted} />
              <View style={styles.dateInfo}>
                <Text style={[styles.dateLabel, { color: colors.textMuted }]}>Vencimento</Text>
                <Text style={[styles.dateValue, { color: colors.text }]}>
                  {bill?.dueDate ? bill.dueDate.toDate().toLocaleDateString('pt-BR') : '-'}
                </Text>
              </View>
            </View>
          </View>
          
          {/* Valor total da fatura */}
          <View style={styles.billAmount}>
            <Text style={[styles.totalLabel, { color: colors.textMuted }]}>Total da Fatura</Text>
            <Text style={[
              styles.totalValue, 
              { color: summary.total > 0 ? colors.expense : colors.success }
            ]}>
              {formatCurrencyBRL(summary.total)}
            </Text>
          </View>
          
          {/* Botão de pagar fatura */}
          {!bill?.isPaid && summary.total > 0 && (
            <Pressable
              style={[styles.payButton, { backgroundColor: colors.primary }]}
              onPress={handlePayBill}
            >
              <MaterialCommunityIcons name="cash-check" size={20} color="#fff" />
              <Text style={styles.payButtonText}>Pagar Fatura</Text>
            </Pressable>
          )}
          {/* Botão desfazer pagamento */}
          {bill?.isPaid && (
            <Pressable
              style={[styles.unpayButton, { borderColor: colors.border }]}
              onPress={() => {
                showAlert(
                  'Desfazer pagamento',
                  'Tem certeza que deseja desfazer o pagamento desta fatura? O débito será estornado na conta usada.',
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Desfazer',
                      onPress: async () => {
                        // Mostrar loading overlay
                        setLoadingOverlay({ visible: true, message: 'Desfazendo pagamento...' });
                        
                        try {
                          await unpayBill(bill.id);
                          
                          // Atualizar dados antes de esconder loading
                          setLoadingOverlay({ visible: true, message: 'Atualizando...' });
                          await loadBillDetails();
                          triggerRefresh();
                          
                          await new Promise(resolve => setTimeout(resolve, 200));
                          
                          setLoadingOverlay({ visible: false, message: '' });
                          showSnackbar('Pagamento desfeito!');
                        } catch (err) {
                          console.error('Erro ao desfazer pagamento:', err);
                          setLoadingOverlay({ visible: false, message: '' });
                          showAlert('Erro', 'Não foi possível desfazer o pagamento', [{ text: 'OK' }]);
                        }
                      }
                    }
                  ]
                );
              }}
            >
              <MaterialCommunityIcons name="undo" size={18} color={colors.text} />
              <Text style={[styles.unpayButtonText, { color: colors.text }]}>
                Desfazer pagamento
              </Text>
            </Pressable>
          )}
        </View>
        
        {/* Lista de transações */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Lançamentos ({bill?.transactions?.length || 0})
        </Text>
        
        {Object.entries(groupedTransactions).map(([date, transactions]) => (
          <View key={date} style={styles.dateGroup}>
            <Text style={[styles.dateHeader, { color: colors.textMuted }]}>{date}</Text>
            {transactions.map((t, index) => (
              <TransactionItem
                key={t.id}
                icon={t.categoryIcon}
                title={t.description}
                account={t.accountName || ''}
                amount={t.type === 'expense' ? -t.amount : t.amount}
                type={t.type === 'expense' ? 'paid' : 'received'}
                category={t.categoryName}
                categoryIcon={t.categoryIcon}
                status="completed"
                isLocked={bill?.isPaid}
                isLastInGroup={index === transactions.length - 1}
                onEdit={!bill?.isPaid ? () => handleEditTransaction(t) : undefined}
              />
            ))}
          </View>
        ))}
        
        {(!bill?.transactions || bill.transactions.length === 0) && !loading && (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="receipt-text-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Nenhum lançamento nesta fatura
            </Text>
          </View>
        )}
        </View>
        </View>
      </ScrollView>
      
      {/* Modal de seleção de conta */}
      <Modal
        visible={payModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPayModalVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setPayModalVisible(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Selecione a conta de pagamento
            </Text>
            
            <ScrollView style={styles.accountList}>
              {activeAccounts.map((account) => (
                <Pressable
                  key={account.id}
                  style={[
                    styles.accountOption,
                    { 
                      borderColor: selectedAccountId === account.id ? colors.primary : colors.border,
                      backgroundColor: selectedAccountId === account.id ? colors.primary + '10' : 'transparent',
                    }
                  ]}
                  onPress={() => {
                    setSelectedAccountId(account.id);
                    setSelectedAccountName(account.name);
                  }}
                >
                  <MaterialCommunityIcons 
                    name={account.icon as any || 'bank'} 
                    size={24} 
                    color={selectedAccountId === account.id ? colors.primary : colors.text} 
                  />
                  <View style={styles.accountInfo}>
                    <Text style={[styles.accountName, { color: colors.text }]}>{account.name}</Text>
                    <Text style={[styles.accountBalance, { color: colors.textMuted }]}>
                      Saldo: {formatCurrencyBRL(account.balance)}
                    </Text>
                  </View>
                  {selectedAccountId === account.id && (
                    <MaterialCommunityIcons name="check-circle" size={24} color={colors.primary} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
            
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, { borderColor: colors.border }]}
                onPress={() => setPayModalVisible(false)}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalButton, 
                  styles.modalButtonPrimary, 
                  { backgroundColor: colors.primary, opacity: paying || !selectedAccountId ? 0.6 : 1 }
                ]}
                onPress={confirmPayment}
                disabled={paying || !selectedAccountId}
              >
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>
                  {paying ? 'Pagando...' : 'Confirmar'}
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
      <CustomAlert
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        buttons={alertState.buttons}
        onClose={hideAlert}
      />
      <Snackbar
        visible={snackbarState.visible}
        message={snackbarState.message}
        type={snackbarState.type}
        duration={snackbarState.duration}
        onDismiss={hideSnackbar}
      />
      <LoadingOverlay
        visible={loadingOverlay.visible}
        message={loadingOverlay.message}
      />
      
      {/* Modal de edição de transação */}
      <AddTransactionModal
        visible={editModalVisible}
        onClose={() => {
          setEditModalVisible(false);
          setEditingTransaction(null);
        }}
        onSave={() => {
          setEditModalVisible(false);
          setEditingTransaction(null);
          loadBillDetails(); // Recarregar fatura após edição
          triggerRefresh(); // Atualizar outros componentes
        }}
        onDelete={async (id: string) => {
          const success = await deleteTransaction(id);
          if (success) {
            setEditModalVisible(false);
            setEditingTransaction(null);
            loadBillDetails(); // Recarregar fatura após exclusão
            triggerRefresh(); // Atualizar outros componentes
          } else {
            showAlert('Erro', 'Não foi possível excluir a transação', [{ text: 'OK' }]);
          }
        }}
        onDeleteSeries={async (seriesId: string) => {
          const success = await deleteTransactionSeries(seriesId);
          if (success) {
            setEditModalVisible(false);
            setEditingTransaction(null);
            loadBillDetails(); // Recarregar fatura após exclusão
            triggerRefresh(); // Atualizar outros componentes
          } else {
            showAlert('Erro', 'Não foi possível excluir a série de transações', [{ text: 'OK' }]);
          }
        }}
        editTransaction={editingTransaction}
      />
    </MainLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  centeredContainer: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  content: {
    padding: spacing.lg,
  },
  monthNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  navButton: {
    padding: spacing.xs,
  },
  monthLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  monthLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  futureBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  futureBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  todayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  todayButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  billCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  billHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  billTitleContainer: {
    marginLeft: spacing.md,
    flex: 1,
  },
  billTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  datesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
  },
  dateItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dateInfo: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  dateSeparator: {
    width: 1,
    height: 32,
    marginHorizontal: spacing.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  billAmount: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  totalLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  totalValue: {
    fontSize: 32,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: spacing.md,
    marginTop: spacing.sm,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  unpayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
    gap: spacing.sm,
    borderWidth: 1,
  },
  unpayButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dueDateText: {
    fontSize: 13,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  dateGroup: {
    marginBottom: spacing.md,
  },
  dateHeader: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: spacing.sm,
    textTransform: 'capitalize',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyText: {
    fontSize: 15,
    marginTop: spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    padding: spacing.lg,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  accountList: {
    maxHeight: 300,
  },
  accountOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    marginBottom: spacing.sm,
  },
  accountInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  accountName: {
    fontSize: 15,
    fontWeight: '500',
  },
  accountBalance: {
    fontSize: 13,
    marginTop: 2,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    borderWidth: 0,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
